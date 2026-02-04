import jwt from 'jsonwebtoken';


const generateToken = (res, id,role="customer") => {
  const token = jwt.sign({ id ,role }, process.env.JWT_SECRET_KEY, { expiresIn: '7d' });

 res.cookie('token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'None',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});


  return token;
};
 
export default generateToken;
