import { Navigate, useParams } from "react-router-dom";

/** Legacy route — revision upload lives on the Approval & GFC register. */
export default function RevisionUploadPage() {
  const { id, drawingId } = useParams();
  if (!id) return <Navigate to="/" replace />;
  const q = new URLSearchParams();
  if (drawingId) {
    q.set("drawingId", drawingId);
    q.set("upload", "rev");
  }
  const qs = q.toString();
  return <Navigate to={`/projects/${id}/drawings${qs ? `?${qs}` : ""}`} replace />;
}
