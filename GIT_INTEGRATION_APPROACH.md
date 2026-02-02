# Git Integration with Database Sync - Implementation Approach

## Overview
Implement Git Clone → Directory Crawl → Database Sync workflow with branch switching support.

---

## PHASE 1: Repository Clone & Initial Sync

### 1.1 Flow Diagram
```
POST /api/projects/clone
    ↓
Validate URL & User Auth
    ↓
Create Project (PostgreSQL)
    ↓
Clone Repository (simple-git)
    ↓ 
Get Default Branch (git.branch())
    ↓
Crawl Directory Tree (fs.readdirSync)
    ↓
Create FileMeta + EditorState + CollaboratorDetail (Transactional)
    ↓
Return ProjectId + Branch Info
```

### 1.2 Step-by-Step Logic

**Step 1: Project Creation**
- Create `Project` record with:
  - `name`: From Git repo name (extracted from URL)
  - `sourceType`: "GIT"
  - `remoteUrl`: The Git URL provided
  - `rootPath`: `/storage/{projectId}/`
  - `currentBranch`: Will be fetched from Git

**Step 2: Git Clone**
```javascript
const git = simpleGit();
await git.clone(remoteUrl, rootPath);
```
- Clone to `/storage/{projectId}/`
- Result: `.git` folder + all files from default branch

**Step 3: Get Default Branch**
```javascript
const repo = simpleGit(rootPath);
const branchSummary = await repo.branch();
// branchSummary.current = default branch name
```

**Step 4: Directory Crawl & Meta Sync**
- Implement recursive function: `syncDirectoryToDb()`
- Parameters:
  - `currentPath`: Physical disk path to scan
  - `projectId`: Database project ID
  - `userId`: Creator ID for permissions
  - `parentId`: Parent FileMeta ID (for hierarchy)
  - `tx`: Prisma transaction
  
**Step 5: Create Metadata Chain**
For each item (file/folder):
- Create `FileMeta`:
  - `name`: Filename/folder name
  - `isFolder`: Boolean
  - `projectId`: Link to project
  - `parentId`: Previous level's ID
  - `absolutePath`: Full disk path
  - `creatorId`: userId
  
- If file (not folder):
  - Create `EditorState`:
    - `content`: Read file from disk using `fs.readFileSync()`
    - `binaryText`: NULL (will be set when editing via Yjs)
  
- Always create `CollaboratorDetail`:
  - `adminId`: userId
  - `editors`: []
  - `viewers`: []

- Recursively call for folders to traverse tree

---

## PHASE 2: Branch Switching & Sync

### 2.1 Flow Diagram
```
POST /api/projects/{id}/switch-branch
    ↓
Validate User Permission
    ↓
Broadcast "Project Reloading" to all connected users (Socket.io)
    ↓
Execute git checkout (simple-git)
    ↓
Crawl New Branch Structure
    ↓
Sync FileMeta:
  - Mark old files as deleted (isDeleted: true)
  - Create new FileMeta for added files
  - Update EditorState.content for modified files
    ↓
Update GitContext: currentBranch for all files
    ↓
Clear Redis shadow docs
    ↓
Broadcast "Project Reloaded" to UI
```

### 2.2 Step-by-Step Logic

**Step 1: Validate Permission**
- Check if user is project owner or has admin permission
- Prevent unauthorized branch switches

**Step 2: Pre-checkout Broadcast**
```javascript
io.to(`project-${projectId}`).emit('project-reloading', {
  projectId,
  targetBranch: branchName,
  message: 'Project structure changing. Please wait...'
});
```
- Notifies all connected users
- Locks the UI temporarily

**Step 3: Git Checkout**
```javascript
const repo = simpleGit(rootPath);
await repo.checkout(branchName);
```
- Disk files now reflect the new branch

**Step 4: Get Old & New Structure**
- `oldStructure`: Query current FileMeta from DB for this project
- `newStructure`: Crawl disk using `fs.readdirSync()` recursively

**Step 5: Diff & Sync Logic**
```
For each file in oldStructure:
  If NOT in newStructure:
    → UPDATE FileMeta.isDeleted = true (don't hard delete)
  Else:
    → Keep FileMeta.id (IMPORTANT: Same ID for existing files)
    → UPDATE EditorState.content from disk
    → UPDATE GitContext.currentBranch (if file record exists)

For each file in newStructure:
  If NOT in oldStructure:
    → CREATE new FileMeta (same process as clone)
```

**Step 6: Update GitContext for All Files**
```javascript
await prisma.gitContext.updateMany({
  where: { fileMeta: { projectId } },
  data: { currentBranch: branchName }
});
```

**Step 7: Clear Redis Session Cache**
```javascript
const projectShadowKey = `shadow:${projectId}`;
await redis.del(projectShadowKey);
// This forces re-hydration when users reopen files
```

**Step 8: Post-checkout Broadcast**
```javascript
io.to(`project-${projectId}`).emit('project-reloaded', {
  projectId,
  branch: branchName,
  files: updatedFileList // Refresh UI tree
});
```

---

## PHASE 3: Additional Git Operations

### 3.1 Fetch Branches
**Endpoint**: `GET /api/projects/{id}/branches`
```javascript
const repo = simpleGit(rootPath);
const branches = await repo.branch(['-a']); // Includes remote branches
// Return: { current, all: [{name, isCurrent}, ...] }
```

### 3.2 Commit Changes
**Endpoint**: `POST /api/projects/{id}/commit`
```
1. Flush all Yjs shadow docs to disk files
2. git add .
3. git commit with GIT_AUTHOR_NAME & GIT_AUTHOR_EMAIL from user profile
4. Return commit hash
```

### 3.3 View Commit History
**Endpoint**: `GET /api/projects/{id}/commits`
```javascript
const logs = await repo.log(['-50', '--pretty=format:%H %s %an %ae %ai']);
// Return: Last 50 commits with metadata
```

### 3.4 Diff Preview
**Endpoint**: `GET /api/projects/{id}/diff/{filePath}`
```javascript
const diff = await repo.diff([filePath]);
// Return: Unified diff format for Monaco DiffEditor
```

---

## PHASE 4: Ignore Pattern Management

### 4.1 Global Ignored Items
```javascript
const IGNORED_FOLDERS = [
  'node_modules', '.git', 'dist', 'build', '__pycache__', ...
];
const IGNORED_FILES = ['.DS_Store', 'thumbs.db'];
```

### 4.2 .gitignore Support (Future Enhancement)
```javascript
// Read .gitignore from disk and parse it
// Use 'ignore' npm package to match patterns
// Apply during crawl
```

---

## PHASE 5: Error Handling & Edge Cases

### 5.1 Clone Failures
- Invalid Git URL
- Network timeout
- Storage permission denied
→ **Solution**: Try-catch, rollback Project record, return error

### 5.2 Checkout Failures
- Branch doesn't exist
- Uncommitted changes conflict
→ **Solution**: Check before checkout, warn user if conflicts exist

### 5.3 Large Repository
- Repo >1GB
- 10,000+ files
→ **Solution**: 
  - Use shallow clone: `git.clone(url, dir, ['--depth=1'])`
  - Implement pagination for file tree UI
  - Use batch inserts for FileMeta

### 5.4 Binary Files
- .png, .pdf, .exe in repo
→ **Solution**: 
  - Flag in FileMeta: `isBinary: true`
  - Don't read into EditorState.content
  - Don't open in Monaco editor

### 5.5 Symbolic Links
- .git/refs might be symlink
→ **Solution**: Skip during crawl, or check `fs.lstatSync()`

---

## Database Operations Overview

### 1. During Clone (Transactional)
```sql
BEGIN TRANSACTION
  INSERT INTO Project (...)
  INSERT INTO FileMeta (multiple rows hierarchically)
  INSERT INTO EditorState (for each file)
  INSERT INTO CollaboratorDetail (for each file)
  INSERT INTO GitContext (for each file)
COMMIT
```

### 2. During Branch Switch (Batched)
```sql
BEGIN TRANSACTION
  UPDATE FileMeta SET isDeleted=true WHERE ...
  INSERT INTO FileMeta (new files)
  UPDATE EditorState SET content=? WHERE ...
  UPDATE GitContext SET currentBranch=? WHERE ...
COMMIT
```

---

## Memory & Performance Considerations

### Crawl Optimization
- Use `fs.readdirSync()` (sync) for single-threaded sequential crawl
- Alternative: `fs.promises.readdir()` (async) for large repos
- Batch inserts: Create 100s of records at once, not individually

### Storage Limits
- Shallow clone to reduce .git size: `--depth=1`
- Limit file size read into memory: Skip >10MB files initially
- Use streams for large file content

### Cache Management
- Store branch list in Redis for 5 minutes
- Store commit history in Redis, expire after 1 hour
- Shadow docs cleared on branch switch

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/projects/clone` | POST | Clone Git repo + sync DB |
| `/api/projects/{id}/branches` | GET | List all branches |
| `/api/projects/{id}/switch-branch` | POST | Checkout branch + sync |
| `/api/projects/{id}/commits` | GET | View commit history (last 50) |
| `/api/projects/{id}/diff/{file}` | GET | View diff for file |
| `/api/projects/{id}/commit` | POST | Create commit |
| `/api/projects/{id}/pull` | POST | Fetch + merge from remote |
| `/api/projects/{id}/push` | POST | Push to remote |

---

## Socket.io Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `project-reloading` | Server → Clients | Notify branch switch starting |
| `project-reloaded` | Server → Clients | Notify branch switch complete + send file tree |
| `file-tree-updated` | Server → Clients | Refresh tree after any file operation |
| `conflict-alert` | Server → Clients | Notify commit conflict |

---

## Implementation Sequence

1. **Week 1.1**: Clone + Initial Sync (Create `cloneGitRepository` controller)
2. **Week 1.2**: Branch Switching (Create `switchBranch` controller)
3. **Week 1.3**: Branch List + Commits (Create `getBranches`, `getCommits` controllers)
4. **Week 1.4**: Diff & Commit (Create `getDiff`, `createCommit` controllers)
5. **Week 1.5**: Error Handling & Edge Cases (Refine all above)

---

## Approval Checklist

- [ ] Clone flow is clear?
- [ ] Branch switch sync logic understood?
- [ ] Database transaction strategy approved?
- [ ] Error handling sufficient?
- [ ] Performance optimizations acceptable?
- [ ] Socket.io notification approach OK?

**Ready to proceed with coding once approved!**
