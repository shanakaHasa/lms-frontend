import Chat from "@/components/Chat";

export default function Home() {
  return (
    <main className="shell">
      <header className="shell__header">
        <h1>ClinicRAG</h1>
        <p>
          Answers are drawn only from this practice&rsquo;s uploaded documents, with a
          citation for every clinical claim.
        </p>
      </header>
      <Chat />
    </main>
  );
}
