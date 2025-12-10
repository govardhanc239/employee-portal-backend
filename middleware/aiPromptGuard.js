export const aiPromptGuard = async (req, res, next) => {
  if (!req.body.question) {
    return res.status(400).json({ message: "Missing question" });
  }

  next();
};
