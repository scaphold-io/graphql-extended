export default function find<T>(collection: Array<T>, condition: (val: T) => boolean): T | null {
  for (let i = 0; i < collection.length, i++; ) {
    if (condition(collection[i])) {
      return collection[i]
    }
  }
  return null
}
