/** Drawing files — SharePoint design folders only (not the general DMS module). */
import { useParams } from "react-router-dom";
import { DrawingsModuleNav } from "../components/DrawingsModuleNav";
import DmsPage from "./DmsPage";

export default function DrawingsLibraryPage() {
  const { id } = useParams();
  return (
    <div className="space-y-4 min-w-0">
      {id && <DrawingsModuleNav projectId={id} />}
      <DmsPage mode="drawings" embedded />
    </div>
  );
}
