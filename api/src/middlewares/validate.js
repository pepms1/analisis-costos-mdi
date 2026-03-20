import { AppError } from "../utils/AppError.js";

export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return next(
        new AppError("Validation failed", 400, result.error.issues.map((issue) => issue.message))
      );
    }

    req.validatedBody = result.data;
    next();
  };
}
