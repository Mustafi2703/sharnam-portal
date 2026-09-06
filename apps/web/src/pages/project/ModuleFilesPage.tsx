import { Link, useParams } from "react-router-dom";
import DmsPage from "../DmsPage";
import { ModulePortalFilesPanel } from "../../components/ModulePortalFilesPanel";
import { MODULE_FILE_CONFIG, moduleFilesKeyFromRoute, type ModuleFilesKey } from "../../lib/moduleIsoFolders";
import { useAuth } from "../../auth";

type Props = {
  moduleKey: ModuleFilesKey;
};

/** Module-scoped SharePoint browser + portal record links (RFI, NCR, exports). */
export default function ModuleFilesPage({ moduleKey }: Props) {
  const { id } = useParams();
  const { token } = useAuth();
  const config = MODULE_FILE_CONFIG[moduleKey];

  return (
    <div className="module-files-page page-scroll-full space-y-4 min-w-0 pb-8 w-full">
      <Link to={`/projects/${id}/${config.hubPath}`} className="text-sm text-brand font-medium">
        ← {config.eyebrow.split("·")[0]?.trim() || "Module"}
      </Link>
      {id && <ModulePortalFilesPanel projectId={id} token={token} config={config} />}
      <DmsPage
        mode="module"
        embedded
        moduleRoot={config.root}
        moduleTitle={config.title}
        moduleEyebrow={config.eyebrow}
        moduleSubtitle={config.subtitle}
        hubLink={`/projects/${id}/${config.hubPath}`}
      />
    </div>
  );
}

export function ModuleFilesRoutePage() {
  const { id, moduleSegment } = useParams();
  const key = moduleFilesKeyFromRoute(moduleSegment || "");
  if (!key || !id) {
    return <p className="text-steel-muted py-8">Unknown module files path.</p>;
  }
  return <ModuleFilesPage moduleKey={key} />;
}
