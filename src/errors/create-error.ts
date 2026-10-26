export function createError(code: string, message: string) {
    return Object.assign(new Error(message), { code });
}