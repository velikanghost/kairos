import { Auth } from "@/components/Auth";

export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <main className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Kairos Trading Agent</h1>
        <Auth />
      </main>
    </div>
  );
}
