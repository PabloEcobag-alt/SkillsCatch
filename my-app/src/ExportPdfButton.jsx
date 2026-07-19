import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';

export default function ExportPdfButton({ roadmapData, userEmail, completedTasks = [] }) {
  const [exporting, setExporting] = useState(false);

  const generatePDF = async () => {
    if (!roadmapData) return;
    setExporting(true);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const checkPageBreak = (needed) => {
        if (y + needed > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
      };

      // --- HEADER ---
      doc.setFillColor(79, 70, 229); // indigo-600
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('SkillsCatch', margin, 18);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('AI-Powered Career Roadmap', margin, 26);
      doc.setFontSize(8);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, 33);
      if (userEmail) {
        doc.text(userEmail, pageWidth - margin, 33, { align: 'right' });
      }
      y = 52;

      // --- TARGET ROLE ---
      doc.setTextColor(79, 70, 229);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`Target Role: ${roadmapData.target_role || roadmapData.data?.recommendedRole || 'N/A'}`, margin, y);
      y += 10;

      // --- PROGRESS ---
      const totalTasks = roadmapData.data?.roadmap?.reduce((acc, w) => acc + (w.tasks?.length || 0), 0) || 0;
      const roleCompleted = completedTasks.filter(t => t.target_role === roadmapData.target_role).length;
      const progressPercent = totalTasks > 0 ? Math.round((roleCompleted / totalTasks) * 100) : 0;

      doc.setTextColor(100, 100, 100);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Progress: ${progressPercent}% Complete (${roleCompleted}/${totalTasks} tasks)`, margin, y);
      y += 4;

      // Progress bar
      doc.setFillColor(229, 231, 235); // gray-200
      doc.roundedRect(margin, y, contentWidth, 4, 2, 2, 'F');
      if (progressPercent > 0) {
        doc.setFillColor(79, 70, 229);
        doc.roundedRect(margin, y, contentWidth * (progressPercent / 100), 4, 2, 2, 'F');
      }
      y += 12;

      // --- JUSTIFICATION ---
      if (roadmapData.data?.justification) {
        checkPageBreak(20);
        doc.setFillColor(238, 242, 255); // indigo-50
        doc.roundedRect(margin, y, contentWidth, 16, 3, 3, 'F');
        doc.setTextColor(55, 48, 163);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        const justLines = doc.splitTextToSize(`"${roadmapData.data.justification}"`, contentWidth - 10);
        doc.text(justLines, margin + 5, y + 6);
        y += 20;
      }

      // --- ROADMAP WEEKS ---
      const roadmap = roadmapData.data?.roadmap || [];
      roadmap.forEach((week) => {
        checkPageBreak(40);

        // Week header
        doc.setFillColor(248, 250, 252); // slate-50
        doc.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F');
        doc.setTextColor(30, 41, 59); // slate-800
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Week ${week.week}: ${week.focus}`, margin + 4, y + 6);
        y += 12;

        // Tasks
        if (week.tasks) {
          week.tasks.forEach((task, tIdx) => {
            checkPageBreak(8);
            const isDone = completedTasks.some(t => 
              t.target_role === roadmapData.target_role && t.week_number === week.week && t.task_index === tIdx
            );
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            
            if (isDone) {
              doc.setTextColor(34, 197, 94); // green-500
              doc.text('[DONE]', margin + 4, y);
              doc.setTextColor(148, 163, 184); // slate-400
            } else {
              doc.setTextColor(71, 85, 105); // slate-600
              doc.text('[ ]', margin + 4, y);
            }
            
            const taskLines = doc.splitTextToSize(task, contentWidth - 25);
            doc.text(taskLines, margin + 18, y);
            y += taskLines.length * 5 + 2;
          });
        }

        // Resources
        if (week.resources && week.resources.length > 0) {
          checkPageBreak(12);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(148, 163, 184);
          doc.text('RESOURCES:', margin + 4, y);
          y += 5;

          week.resources.forEach((res) => {
            checkPageBreak(7);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(79, 70, 229);
            const label = `${res.label} (${res.difficulty || 'General'})`;
            doc.textWithLink(label, margin + 8, y, { url: res.url });
            y += 5;
          });
        }

        y += 6;
      });

      // --- FOOTER ---
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(180, 180, 180);
        doc.text(
          `SkillsCatch Career Roadmap | Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        );
      }

      // Save
      const fileName = `SkillsCatch_${(roadmapData.target_role || 'Roadmap').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={generatePDF}
      disabled={exporting || !roadmapData}
      className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors disabled:opacity-50"
    >
      {exporting ? <><Loader2 size={16} className="animate-spin" /> Exporting...</> : <><Download size={16} /> Export PDF</>}
    </button>
  );
}
