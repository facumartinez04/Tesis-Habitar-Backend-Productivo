export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Recurso no encontrado') {
    super(404, message);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Solicitud inválida') {
    super(400, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'No autenticado') {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'No autorizado') {
    super(403, message);
  }
}

export class UpstreamError extends HttpError {
  constructor(message = 'Falló la comunicación con un servicio externo') {
    super(502, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflicto con el estado actual del recurso') {
    super(409, message);
  }
}
