/** True when the editor holds no visible text (just <br>, empty <p>, etc.). */
export function isEmptyEmailHtml(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim() === ""
  );
}
