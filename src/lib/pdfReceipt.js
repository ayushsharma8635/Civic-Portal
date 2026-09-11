import { jsPDF } from "jspdf";
import moment from "moment";

export async function generateComplaintReceipt(complaint, user) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = 0;

  // Header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 70, "F");
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, 5, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Civic Portal", M + 8, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 220);
  doc.text("Smart Complaint Management System", M + 8, 52);

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("COMPLAINT RECEIPT", W - M, 36, { align: "right" });
  doc.text(moment().format("DD MMM YYYY, h:mm A"), W - M, 52, { align: "right" });

  y = 100;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(complaint.title, M, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  const code = complaint.complaint_code || complaint.id;
  doc.text(`Complaint ID: ${code}`, M, y + 14);

  // Status badge
  doc.setFillColor(complaint.status === "Resolved" ? 34 : complaint.is_delayed ? 239 : 99, complaint.status === "Resolved" ? 197 : complaint.is_delayed ? 68 : 102, complaint.status === "Resolved" ? 94 : complaint.is_delayed ? 68 : 241);
  doc.roundedRect(W - M - 90, y + 2, 90, 22, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(complaint.is_delayed ? "DELAYED" : complaint.status.toUpperCase(), W - M - 45, y + 16, { align: "center" });

  y += 36;
  doc.setDrawColor(226, 232, 240);
  doc.line(M, y, W - M, y);
  y += 24;

  // Info grid
  const rows = [
    ["Citizen Name", user?.full_name || user?.email || "—"],
    ["Category", complaint.category || "—"],
    ["Priority", complaint.priority || "—"],
    ["Department", complaint.department || "Not assigned yet"],
    ["Area / Location", complaint.area || complaint.location || "—"],
    ["Submission Date", complaint.created_date ? moment(complaint.created_date).format("DD MMM YYYY, h:mm A") : "—"],
    ["Expected Resolution", complaint.expected_date ? moment(complaint.expected_date).format("DD MMM YYYY") : "—"],
    ["Assigned Area Admin", complaint.department ? complaint.department : "—"],
  ];

  doc.setFontSize(10);
  rows.forEach(([label, val], i) => {
    const col = i % 2;
    const ry = y + Math.floor(i / 2) * 26;
    const cx = col === 0 ? M : W / 2;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(label, cx, ry);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(String(val), cx, ry + 13);
  });
  y += Math.ceil(rows.length / 2) * 26 + 10;

  doc.setDrawColor(226, 232, 240);
  doc.line(M, y, W - M, y);
  y += 20;

  // Description
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(10);
  doc.text("Description", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  const desc = doc.splitTextToSize(complaint.description || "—", W - 2 * M);
  doc.text(desc, M, y);
  y += desc.length * 13 + 16;

  // Temporary solution
  if (complaint.temporary_solution) {
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(M, y, W - 2 * M, 0, 4, 4, "F");
    const tempLines = [];
    tempLines.push(`Temporary Solution: ${complaint.temporary_solution}`);
    if (complaint.temp_alt_route) tempLines.push(`Alternate Route: ${complaint.temp_alt_route}`);
    if (complaint.temp_alt_facility) tempLines.push(`Alternative Facility: ${complaint.temp_alt_facility}`);
    if (complaint.temp_availability_time) tempLines.push(`Availability: ${complaint.temp_availability_time}`);
    if (complaint.temp_contact) tempLines.push(`Contact: ${complaint.temp_contact}`);

    const wrapped = doc.splitTextToSize(tempLines.join("\n"), W - 2 * M - 24);
    const boxH = wrapped.length * 13 + 20;
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(M, y, W - 2 * M, boxH, 4, 4, "F");
    doc.setTextColor(146, 64, 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("⚠ Temporary Solution", M + 12, y + 16);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 53, 15);
    doc.text(wrapped, M + 12, y + 32);
    y += boxH + 16;
  }

  // QR code
  const trackUrl = `${window.location.origin}/track?id=${complaint.id}`;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(trackUrl)}`;
  try {
    const resp = await fetch(qrImgUrl);
    const blob = await resp.blob();
    const base64 = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result.split(",")[1]);
      r.readAsDataURL(blob);
    });
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(W - M - 100, y, 90, 90, 4, 4, "F");
    doc.addImage(base64, "PNG", W - M - 95, y + 5, 80, 80);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Scan to track", W - M - 55, y + 100, { align: "center" });
  } catch {}

  // Footer
  const fy = doc.internal.pageSize.getHeight() - 50;
  doc.setDrawColor(226, 232, 240);
  doc.line(M, fy, W - M, fy);
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Civic Portal — Smart Complaint Management System", M, fy + 16);
  doc.text("This is a system-generated receipt. For queries, contact your local civic office.", M, fy + 30);
  doc.text(trackUrl, W - M, fy + 16, { align: "right" });

  const fileName = `CivicPortal_Complaint_${code}.pdf`;
  doc.save(fileName);
}