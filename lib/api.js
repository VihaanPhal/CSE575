import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function parseIntegerParam(value, name, options = {}) {
  const { min, max, required = true } = options;

  if (value === null || value === undefined || value === "") {
    if (!required) return undefined;
    throw new ApiError(400, "MISSING_PARAM", `Missing '${name}' parameter.`);
  }

  if (!/^-?\d+$/.test(String(value))) {
    throw new ApiError(400, "INVALID_PARAM", `'${name}' must be an integer.`);
  }

  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    throw new ApiError(400, "INVALID_PARAM", `'${name}' must be an integer.`);
  }
  if (min !== undefined && parsed < min) {
    throw new ApiError(400, "OUT_OF_RANGE", `'${name}' must be at least ${min}.`);
  }
  if (max !== undefined && parsed > max) {
    throw new ApiError(400, "OUT_OF_RANGE", `'${name}' must be at most ${max}.`);
  }
  return parsed;
}

export function parseModelParam(value, allowedModels) {
  if (!value) return allowedModels[0];
  if (!allowedModels.includes(value)) {
    throw new ApiError(
      400,
      "INVALID_MODEL",
      `Model must be one of: ${allowedModels.join(", ")}.`
    );
  }
  return value;
}

export function parseJsonBody(body, fieldName) {
  if (!body || typeof body !== "object") {
    throw new ApiError(400, "INVALID_BODY", "Request body must be a JSON object.");
  }

  if (!(fieldName in body)) {
    throw new ApiError(400, "MISSING_FIELD", `Missing '${fieldName}' in request body.`);
  }

  return body[fieldName];
}

export function handleApiError(error) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      { status: error.status }
    );
  }

  console.error(error);
  return NextResponse.json(
    {
      code: "INTERNAL_ERROR",
      message: "Something went wrong while processing this request.",
    },
    { status: 500 }
  );
}
