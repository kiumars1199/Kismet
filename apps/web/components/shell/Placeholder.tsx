// Temporary page body. Each lane replaces its page file.
export function Placeholder({ title, line }: { title: string; line: string }) {
  return (
    <section className="mx-auto max-w-3xl py-10">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-3 text-muted">{line}</p>
    </section>
  );
}
