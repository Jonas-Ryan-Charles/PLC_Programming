import Inspector from "./Inspector";
import InstructionPalette from "./InstructionPalette";
import LadderProgram from "./LadderProgram";
import SandboxChassis from "./SandboxChassis";
import SandboxWatch from "./SandboxWatch";
import WorkspaceToolbar from "./WorkspaceToolbar";

export default function Workspace() {
  return (
    <div className="flex h-screen flex-col bg-ink text-gray-200">
      <WorkspaceToolbar />
      <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr_340px]">
        {/* palette */}
        <section className="min-h-0 border-r border-[#21262D]">
          <InstructionPalette />
        </section>

        {/* ladder + inspector */}
        <section className="grid min-h-0 grid-rows-[1fr_auto] border-r border-[#21262D]">
          <div className="min-h-0">
            <LadderProgram />
          </div>
          <Inspector />
        </section>

        {/* chassis + watch */}
        <section className="grid min-h-0 grid-rows-[1fr_220px]">
          <div className="min-h-0 overflow-auto p-2">
            <SandboxChassis />
          </div>
          <div className="min-h-0 border-t border-[#21262D]">
            <SandboxWatch />
          </div>
        </section>
      </div>
    </div>
  );
}
