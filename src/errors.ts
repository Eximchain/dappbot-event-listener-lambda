// CUSTOM ERROR TYPES

export class ProcessingError {
    name:string
    message:string
    constructor(message:string) {
        this.name = "ProcessingError";
        this.message = message;
    }
}

export class StateValidationError extends ProcessingError {
    constructor(message:string) {
        super(message);
        this.name = "StateValidationError";
    }
}

export class PermissionError extends ProcessingError {
    constructor(message:string) {
        super(message);
        this.name = "PermissionError";
    }
}

export class InternalProcessingError extends ProcessingError {
    constructor(message:string) {
        super(message);
        this.name = "InternalProcessingError";
    }
}

// ASSERT METHODS

function assert(condition:any, message:string, errorType=ProcessingError) {
    if (!condition) {
        throw new errorType(message);
    }
}

export function assertStateValid(condition:any, message:string) {
    return assert(condition, message, StateValidationError);
}

export function assertPermission(condition:any, message:string) {
    return assert(condition, message, PermissionError);
}

export function assertInternal(condition:any) {
    let message = "Internal error during processing";
    return assert(condition, message, InternalProcessingError);
}

export function throwInternalValidationError() {
    return assertInternal(false);
}

export default { assertStateValid, assertPermission, assertInternal, throwInternalValidationError };