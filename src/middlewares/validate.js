import { ValidationError } from "../errors/index.js";

function formatIssues(error, location) {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : location,
    message: issue.message,
    location,
  }));
}

export function validate(schemas) {
  return (req, _res, next) => {
    req.validated = req.validated ?? {};
    const details = [];

    for (const [location, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[location] ?? {});
      if (result.success) {
        req.validated[location] = result.data;
      } else {
        details.push(...formatIssues(result.error, location));
      }
    }

    if (details.length === 0) {
      return next();
    }

    const onlyBody = details.every((detail) => detail.location === "body");
    next(new ValidationError(details, { status: onlyBody ? 422 : 400 }));
  };
}
