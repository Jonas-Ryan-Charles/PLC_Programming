import { useEffect } from "react";
import Auth from "./components/sandbox/Auth";
import Hub from "./components/Hub";
import StudioBrowser from "./components/sandbox/StudioBrowser";
import Workspace from "./components/sandbox/Workspace";
import CoursePage from "./components/academy/CoursePage";
import WiringLab from "./components/wiring/WiringLab";
import CertificatesPage from "./components/certificates/CertificatesPage";
import { useProject } from "./store/projectStore";

export default function App() {
  const init = useProject((s) => s.init);
  const sessionChecked = useProject((s) => s.sessionChecked);
  const user = useProject((s) => s.user);
  const section = useProject((s) => s.section);
  const project = useProject((s) => s.project);

  useEffect(() => {
    init();
  }, [init]);

  if (!sessionChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink text-sm text-gray-500">
        Restoring session…
      </div>
    );
  }

  if (!user) return <Auth />;

  switch (section) {
    case "studio":
      // Inside the Studio: a chosen file opens the workspace, otherwise the file browser.
      return project ? <Workspace /> : <StudioBrowser />;
    case "academy":
      return <CoursePage />;
    case "wiring":
      return <WiringLab />;
    case "certificates":
      return <CertificatesPage />;
    default:
      return <Hub />;
  }
}
