/**
 * authorize(["admin", "faculty"])
 * Must be used AFTER verifyToken middleware.
 */
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Allowed roles: ${allowedRoles.join(", ")}`,
      });
    }
    next();
  };
};

module.exports = authorize;
