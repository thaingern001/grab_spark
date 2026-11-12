class AppError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def not_found() -> AppError:
    return AppError(404, "not_found", "Resource not found")


def conflict(message: str) -> AppError:
    return AppError(409, "conflict", message)
