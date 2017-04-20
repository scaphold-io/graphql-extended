export async function asyncReduce<Acc, T>(
  reducer: (acc: Promise<Acc>, elem: T, ind: number) => Promise<Acc>,
  initialValue: Promise<Acc>,
  iterable: Array<T>,
): Promise<Acc> {
  return await iterable.reduce(reducer, initialValue)
}
