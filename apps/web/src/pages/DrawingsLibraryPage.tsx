/** Drawing files — SharePoint design folders only (not the general DMS module). */
import DmsPage from "./DmsPage";

export default function DrawingsLibraryPage() {
  return (
    <div className="space-y-4 min-w-0">
      <DmsPage mode="drawings" embedded />
    </div>
  );
}
