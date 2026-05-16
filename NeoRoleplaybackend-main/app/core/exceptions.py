from fastapi import HTTPException


class AppError(HTTPException):
    def __init__(self, status_code: int, message: str):
        super().__init__(status_code=status_code, detail=message)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(401, message)


class ForbiddenError(AppError):
    def __init__(self, message: str = "Forbidden"):
        super().__init__(403, message)


class NotFoundError(AppError):
    def __init__(self, message: str = "Not found"):
        super().__init__(404, message)


class ConflictError(AppError):
    def __init__(self, message: str = "Conflict"):
        super().__init__(409, message)


class PaymentRequiredError(AppError):
    def __init__(self, message: str = "Payment required"):
        super().__init__(402, message)


class ValidationError(AppError):
    def __init__(self, message: str = "Validation error"):
        super().__init__(400, message)
