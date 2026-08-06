/** Empty state viết theo giọng sản phẩm, hướng dẫn hành động tiếp theo — không dùng
 * copy chung chung kiểu "No data found". */
export function EmptyState({ message }: { message: string }) {
  return <p className="ui-empty">{message}</p>;
}
