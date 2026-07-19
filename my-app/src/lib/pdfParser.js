import * as pdfjsLib from 'pdfjs-dist';

// Vite Specific Trick: We have to import the "Web Worker" this exact way
// so it doesn't freeze the browser while reading heavy PDFs.
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export const extractTextFromPDF = async (file) => {
  try {
    // 1. Convert the uploaded file into a raw data buffer
    const arrayBuffer = await file.arrayBuffer();
    
    // 2. Load the document into PDF.js
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    // 3. Loop through every single page in the PDF
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // 4. Extract the actual words and stitch them together with spaces
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + ' \n';
    }
    
    return fullText;
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    throw new Error("Could not read the PDF file. Please ensure it is a valid document.");
  }
};