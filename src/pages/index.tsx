import { AgentStore } from '../stores/agentStore';

export default function Home() {
  // Use Zustand store directly as hooks
  const agents = AgentStore((state) => state.agents);
  const runningAgents = AgentStore((state) => state.runningAgents);

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">AI Agents CLI</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Agents Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded">
              <p className="text-blue-700 font-semibold">Total Agents</p>
              <p className="text-3xl">{agents.length}</p>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <p className="text-green-700 font-semibold">Running Agents</p>
              <p className="text-3xl">{runningAgents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">Agent List</h2>
          <div className="space-y-4">
            {agents.map((agent: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded">
                <span>{agent.name}</span>
                <span className={`px-2 py-1 rounded ${agent.status === 'running' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                  {agent.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
