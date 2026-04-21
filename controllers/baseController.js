export class BaseController {
  sendSuccess(res, data, message, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }

  // Common error handling wrapper
  handleRequest(fn) {
    return (req, res, next) => {
      fn(req, res, next).catch(next);
    };
  }
}

// Create an instance of BaseController to handle common controller logic
const baseController = new BaseController();
export { baseController };
