const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    console.log(err.message)
    res.status(statusCode).json({
      success: false,
      message: err.message || 'Internal Server Error',
    });
  };
  
  export default errorHandler;
  