import AgentControl from "@/components/dashboard/AgentControl";

export default function WebAgentsPage() {
  return (
    <div className="max-w-4xl mx-auto pb-12">
      <header className="mb-10">
        <h1 className="text-4xl font-bold mb-2">Web Agents</h1>
        <p className="text-white/50">Manage autonomous background agents executing web tasks.</p>
      </header>
      <AgentControl />
    </div>
  );
}
