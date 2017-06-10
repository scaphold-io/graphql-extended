export default function invariant(condition: {} | string | number | boolean | undefined | null, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}
