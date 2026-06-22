/**
 * Выполнить асинхронную операцию с повторами при ошибке.
 * @param fn       что выполнить (функция, возвращающая Promise)
 * @param attempts сколько всего попыток, включая первую
 * @param delayMs  пауза между попытками, мс
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    attempts = 3,
    delayMs = 2000
): Promise<T> {
    let lastError: unknown;

    for (let i = 1; i <= attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`[retry] попытка ${i}/${attempts} не удалась: ${message}`);

            // Пауза перед следующей попыткой — но не после последней.
            if (i < attempts) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }

    throw lastError;
}