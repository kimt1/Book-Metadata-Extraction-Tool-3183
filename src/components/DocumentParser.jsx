import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';

const { FiUpload, FiDownload, FiCopy, FiCheck, FiAlertCircle, FiZap, FiImage, FiEye, FiEyeOff } = FiIcons;

const DocumentParser = () => {
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [includeImagePrompts, setIncludeImagePrompts] = useState(false);

  const GEMINI_API_KEY = 'AIzaSyDaNnFmUtTlaVfkA2qDY8Z7apZGea8njlM';

  const LLM_CHOICES = ['Claude', 'Sonnet', 'Chatgpt', 'OpenAI', 'Gemini', 'Deepseek'];
  const IMAGE_GENERATOR_CHOICES = ['Ideogram', 'Chatgpt', 'Imagen', 'Recraft', 'Canva', 'Midjourney'];

  const parseWithGemini = async (text) => {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Parse this document and extract the following information in JSON format. Be very precise and extract content verbatim:

IMPORTANT INSTRUCTIONS:
- For keywords: Look for a section titled "KEYWORDS" (in capital letters) and extract exactly 7 keywords as separate items
- For image prompts: Look for a section titled "Image Prompts" or similar and extract exactly 5 prompts as separate items
- For subtitle: Extract everything after the colon but BEFORE "by" (exclude the author name)
- For names: If there are 3 parts (first middle last), combine first and middle as firstName, last as lastName
- For HTML salesletter: Look for sections titled "SALESLETTER" (in capital letters) OR "Amazon Book Description" OR "Sales Copy" OR sections with HTML tags like <p>, <div>, <strong>, <em>, <br>, etc.
- For AI LLM: Look for sections titled "AI LLM" or similar
- For AI Image Generator: Look for sections titled "AI Image Generator" or similar

{
  "bookTitle": "extract the main title before the colon, excluding any 'by Author' part",
  "subtitle": "extract everything after the colon but BEFORE 'by' if it exists (do not include author name)",
  "authorFirstName": "first name and middle name combined if exists (e.g., Joan Grace for Joan Grace Amira)",
  "authorLastName": "last name only (e.g., Amira for Joan Grace Amira)",
  "htmlSalesletter": "extract everything after 'SALESLETTER' section OR 'Amazon Book Description' OR 'Sales Copy' section OR any section with lots of HTML tags - all in one paragraph",
  "backBookCover": "extract content from 'Back Book Cover' section - all in one paragraph",
  "aiLlm": "extract content from 'AI LLM' section - all in one paragraph",
  "aiImageGenerator": "extract content from 'AI Image Generator' section - all in one paragraph",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7"],
  "imagePrompts": ["prompt1", "prompt2", "prompt3", "prompt4", "prompt5"]
}

Document to parse:
${text}`
            }]
          }]
        })
      });

      const result = await response.json();
      const generatedText = result.candidates[0].content.parts[0].text;
      
      // Extract JSON from the response
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Could not parse JSON from Gemini response');
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  };

  const detectHTMLContent = (lines) => {
    const htmlTags = ['<p>', '<div>', '<strong>', '<em>', '<br>', '<span>', '<h1>', '<h2>', '<h3>', '<h4>', '<h5>', '<h6>', '<ul>', '<li>', '<ol>', '<a>', '<img>', '</p>', '</div>', '</strong>', '</em>', '</span>', '</h1>', '</h2>', '</h3>', '</h4>', '</h5>', '</h6>', '</ul>', '</li>', '</ol>', '</a>'];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      let htmlTagCount = 0;
      
      htmlTags.forEach(tag => {
        const matches = line.match(new RegExp(tag.replace(/[<>]/g, '\\$&'), 'gi'));
        if (matches) {
          htmlTagCount += matches.length;
        }
      });
      
      // If a line has 3 or more HTML tags, consider it HTML content
      if (htmlTagCount >= 3) {
        return i;
      }
    }
    
    return -1;
  };

  const getRandomChoice = (choices) => {
    return choices[Math.floor(Math.random() * choices.length)];
  };

  const parseDocument = async () => {
    try {
      setError('');
      setLoading(true);
      
      if (!inputText.trim()) {
        setError('Please paste your document first');
        setLoading(false);
        return;
      }

      // Try Gemini AI first
      try {
        const geminiResult = await parseWithGemini(inputText);
        
        // Random selections for AI tools (same for both versions)
        const selectedLLM = getRandomChoice(LLM_CHOICES);
        const selectedImageGenerator = getRandomChoice(IMAGE_GENERATOR_CHOICES);
        
        setParsedData({
          bookTitle: geminiResult.bookTitle || '',
          subtitle: geminiResult.subtitle || '',
          authorFirstName: geminiResult.authorFirstName || '',
          authorLastName: geminiResult.authorLastName || '',
          htmlSalesletter: geminiResult.htmlSalesletter || '',
          backBookCover: geminiResult.backBookCover || '',
          aiLlm: geminiResult.aiLlm || selectedLLM,
          aiImageGenerator: geminiResult.aiImageGenerator || selectedImageGenerator,
          keywords: Array.isArray(geminiResult.keywords) ? geminiResult.keywords : [],
          imagePrompts: Array.isArray(geminiResult.imagePrompts) ? geminiResult.imagePrompts : []
        });
        setLoading(false);
        return;
      } catch (geminiError) {
        console.warn('Gemini parsing failed, falling back to manual parsing:', geminiError);
      }

      // Fallback to manual parsing
      const sections = {
        bookTitle: '',
        subtitle: '',
        authorFirstName: '',
        authorLastName: '',
        htmlSalesletter: '',
        backBookCover: '',
        aiLlm: '',
        aiImageGenerator: '',
        keywords: [],
        imagePrompts: []
      };

      const lines = inputText.split('\n').map(line => line.trim()).filter(line => line);
      
      // Find book title and subtitle
      const titleLine = lines.find(line => 
        line.includes(':') && 
        !line.toLowerCase().includes('author') &&
        !line.toLowerCase().includes('keyword') &&
        !line.toLowerCase().includes('image') &&
        !line.toLowerCase().includes('prompt')
      );
      
      if (titleLine) {
        const [title, ...rest] = titleLine.split(':');
        const afterColon = rest.join(':').trim();
        
        sections.bookTitle = title.trim();
        
        if (afterColon.toLowerCase().includes(' by ')) {
          const byIndex = afterColon.toLowerCase().indexOf(' by ');
          sections.subtitle = afterColon.substring(0, byIndex).trim();
          
          const authorPart = afterColon.substring(byIndex + 4).trim();
          const nameParts = authorPart.split(' ').filter(part => part.trim());
          
          if (nameParts.length >= 3) {
            sections.authorFirstName = nameParts.slice(0, -1).join(' ');
            sections.authorLastName = nameParts[nameParts.length - 1];
          } else if (nameParts.length === 2) {
            sections.authorFirstName = nameParts[0];
            sections.authorLastName = nameParts[1];
          } else if (nameParts.length === 1) {
            sections.authorFirstName = nameParts[0];
          }
        } else {
          sections.subtitle = afterColon;
        }
      }

      // Find author information if not found above
      if (!sections.authorFirstName) {
        const authorLine = lines.find(line => 
          line.toLowerCase().includes('author') && line.includes(':')
        );
        
        if (authorLine) {
          const authorName = authorLine.split(':')[1]?.trim() || '';
          const nameParts = authorName.split(' ').filter(part => part.trim());
          
          if (nameParts.length >= 3) {
            sections.authorFirstName = nameParts.slice(0, -1).join(' ');
            sections.authorLastName = nameParts[nameParts.length - 1];
          } else if (nameParts.length === 2) {
            sections.authorFirstName = nameParts[0];
            sections.authorLastName = nameParts[1];
          } else if (nameParts.length === 1) {
            sections.authorFirstName = nameParts[0];
          }
        }
      }

      // Find HTML salesletter - Priority order: 1) SALESLETTER 2) Amazon Book Description 3) Sales Copy 4) HTML detection
      let salesletterIndex = -1;
      
      // First priority: Look for "SALESLETTER" in all caps
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toUpperCase();
        if (line === 'SALESLETTER') {
          salesletterIndex = i;
          break;
        }
      }
      
      // Second priority: Look for other labeled sections if SALESLETTER not found
      if (salesletterIndex === -1) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].toLowerCase();
          if (line.includes('amazon book description') || 
              line.includes('sales copy') || 
              line.includes('book description')) {
            salesletterIndex = i;
            break;
          }
        }
      }
      
      if (salesletterIndex !== -1) {
        let salesletterLines = [];
        for (let i = salesletterIndex + 1; i < lines.length; i++) {
          const line = lines[i];
          const lowerLine = line.toLowerCase();
          if (lowerLine.includes('back book cover') ||
              lowerLine === 'keywords' ||
              lowerLine.includes('image prompt') ||
              lowerLine.includes('ai llm') ||
              lowerLine.includes('ai image generator')) {
            break;
          }
          if (line.trim()) {
            salesletterLines.push(line);
          }
        }
        sections.htmlSalesletter = salesletterLines.join(' ').trim();
      } else {
        // Third priority: If no labeled section found, look for HTML content
        const htmlStartIndex = detectHTMLContent(lines);
        if (htmlStartIndex !== -1) {
          let salesletterLines = [];
          for (let i = htmlStartIndex; i < lines.length; i++) {
            const line = lines[i];
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('back book cover') ||
                lowerLine === 'keywords' ||
                lowerLine.includes('image prompt') ||
                lowerLine.includes('ai llm') ||
                lowerLine.includes('ai image generator')) {
              break;
            }
            if (line.trim()) {
              salesletterLines.push(line);
            }
          }
          sections.htmlSalesletter = salesletterLines.join(' ').trim();
        }
      }

      // Find back book cover
      let backCoverIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes('back book cover')) {
          backCoverIndex = i;
          break;
        }
      }
      
      if (backCoverIndex !== -1) {
        let backCoverLines = [];
        for (let i = backCoverIndex + 1; i < lines.length; i++) {
          const line = lines[i];
          const lowerLine = line.toLowerCase();
          if (lowerLine === 'keywords' ||
              lowerLine.includes('image prompt') ||
              lowerLine.includes('ai llm') ||
              lowerLine.includes('ai image generator')) {
            break;
          }
          if (line.trim()) {
            backCoverLines.push(line);
          }
        }
        sections.backBookCover = backCoverLines.join(' ').trim();
      }

      // Find AI LLM section
      let aiLlmIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('ai llm') || line === 'ai llm') {
          aiLlmIndex = i;
          break;
        }
      }
      
      if (aiLlmIndex !== -1) {
        let aiLlmLines = [];
        for (let i = aiLlmIndex + 1; i < lines.length; i++) {
          const line = lines[i];
          const lowerLine = line.toLowerCase();
          if (lowerLine === 'keywords' ||
              lowerLine.includes('image prompt') ||
              lowerLine.includes('ai image generator') ||
              lowerLine.includes('back book cover')) {
            break;
          }
          if (line.trim()) {
            aiLlmLines.push(line);
          }
        }
        sections.aiLlm = aiLlmLines.join(' ').trim();
      }

      // Find AI Image Generator section
      let aiImageGenIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('ai image generator') || line === 'ai image generator') {
          aiImageGenIndex = i;
          break;
        }
      }
      
      if (aiImageGenIndex !== -1) {
        let aiImageGenLines = [];
        for (let i = aiImageGenIndex + 1; i < lines.length; i++) {
          const line = lines[i];
          const lowerLine = line.toLowerCase();
          if (lowerLine === 'keywords' ||
              lowerLine.includes('image prompt') ||
              lowerLine.includes('ai llm') ||
              lowerLine.includes('back book cover')) {
            break;
          }
          if (line.trim()) {
            aiImageGenLines.push(line);
          }
        }
        sections.aiImageGenerator = aiImageGenLines.join(' ').trim();
      }

      // Find KEYWORDS section
      let keywordsIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toUpperCase() === 'KEYWORDS') {
          keywordsIndex = i;
          break;
        }
      }
      
      if (keywordsIndex !== -1) {
        let allKeywords = [];
        for (let i = keywordsIndex + 1; i < lines.length; i++) {
          const line = lines[i];
          const lowerLine = line.toLowerCase();
          
          if (lowerLine.includes('image prompt') || 
              lowerLine.includes('back book cover') ||
              lowerLine.includes('amazon book description') ||
              lowerLine.includes('ai llm') ||
              lowerLine.includes('ai image generator') ||
              lowerLine === 'salesletter') {
            break;
          }
          
          if (line.trim()) {
            const keywords = line.split(',').map(k => k.trim()).filter(k => k);
            allKeywords.push(...keywords);
          }
        }
        
        // Randomly select 7 keywords
        const shuffled = allKeywords.sort(() => 0.5 - Math.random());
        sections.keywords = shuffled.slice(0, 7);
      }

      // Find Image Prompts section
      let imagePromptsIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('image prompt') || line === 'image prompts') {
          imagePromptsIndex = i;
          break;
        }
      }
      
      if (imagePromptsIndex !== -1) {
        let prompts = [];
        for (let i = imagePromptsIndex + 1; i < lines.length && prompts.length < 5; i++) {
          const line = lines[i].trim();
          
          const lowerLine = line.toLowerCase();
          if (lowerLine === 'keywords' ||
              lowerLine.includes('back book cover') ||
              lowerLine.includes('amazon book description') ||
              lowerLine.includes('ai llm') ||
              lowerLine.includes('ai image generator') ||
              lowerLine === 'salesletter') {
            break;
          }
          
          if (line) {
            let cleanPrompt = line.replace(/^\d+\.\s*/, '').replace(/^•\s*/, '').trim();
            if (cleanPrompt) {
              prompts.push(cleanPrompt);
            }
          }
        }
        sections.imagePrompts = prompts;
      }

      // Random selections for AI tools (same for both versions)
      const selectedLLM = getRandomChoice(LLM_CHOICES);
      const selectedImageGenerator = getRandomChoice(IMAGE_GENERATOR_CHOICES);
      
      sections.aiLlm = sections.aiLlm || selectedLLM;
      sections.aiImageGenerator = sections.aiImageGenerator || selectedImageGenerator;

      setParsedData(sections);
      setLoading(false);
    } catch (err) {
      setError('Error parsing document. Please check the format.');
      console.error(err);
      setLoading(false);
    }
  };

  const formatForGoogleSheets = () => {
    if (!parsedData) return '';
    
    // Generate different keyword sets for ebook and paperback
    const allKeywords = [...parsedData.keywords];
    const shuffledKeywords1 = [...allKeywords].sort(() => 0.5 - Math.random()).slice(0, 7);
    const shuffledKeywords2 = [...allKeywords].sort(() => 0.5 - Math.random()).slice(0, 7);
    
    const data = [
      'Classification\tValues\tSelectors',
      `Book Title\t${parsedData.bookTitle}\t`,
      `Subtitle\t${parsedData.subtitle}\t`,
      `Author First Name\t${parsedData.authorFirstName}\t`,
      `Author Last Name\t${parsedData.authorLastName}\t`,
      `HTML Salesletter\t${parsedData.htmlSalesletter}\t`,
      `Back Book Cover\t${parsedData.backBookCover}\t`,
      `AI LLM\t${parsedData.aiLlm}\t`,
      `AI Image Generator\t${parsedData.aiImageGenerator}\t`,
      `Keyword 1\t${shuffledKeywords1[0] || ''}\t`,
      `Keyword 2\t${shuffledKeywords1[1] || ''}\t`,
      `Keyword 3\t${shuffledKeywords1[2] || ''}\t`,
      `Keyword 4\t${shuffledKeywords1[3] || ''}\t`,
      `Keyword 5\t${shuffledKeywords1[4] || ''}\t`,
      `Keyword 6\t${shuffledKeywords1[5] || ''}\t`,
      `Keyword 7\t${shuffledKeywords1[6] || ''}\t`
    ];

    // Add image prompts if toggle is enabled
    if (includeImagePrompts) {
      data.push(
        `Image Prompt 1\t${parsedData.imagePrompts[0] || ''}\t`,
        `Image Prompt 2\t${parsedData.imagePrompts[1] || ''}\t`,
        `Image Prompt 3\t${parsedData.imagePrompts[2] || ''}\t`,
        `Image Prompt 4\t${parsedData.imagePrompts[3] || ''}\t`,
        `Image Prompt 5\t${parsedData.imagePrompts[4] || ''}\t`
      );
    }

    // Paperback version (no headers, just continuous data)
    data.push(
      `Book Title\t${parsedData.bookTitle}\t`,
      `Subtitle\t${parsedData.subtitle}\t`,
      `Author First Name\t${parsedData.authorFirstName}\t`,
      `Author Last Name\t${parsedData.authorLastName}\t`,
      `HTML Salesletter\t${parsedData.htmlSalesletter}\t`,
      `Back Book Cover\t${parsedData.backBookCover}\t`,
      `AI LLM\t${parsedData.aiLlm}\t`,
      `AI Image Generator\t${parsedData.aiImageGenerator}\t`,
      `Keyword 1\t${shuffledKeywords2[0] || ''}\t`,
      `Keyword 2\t${shuffledKeywords2[1] || ''}\t`,
      `Keyword 3\t${shuffledKeywords2[2] || ''}\t`,
      `Keyword 4\t${shuffledKeywords2[3] || ''}\t`,
      `Keyword 5\t${shuffledKeywords2[4] || ''}\t`,
      `Keyword 6\t${shuffledKeywords2[5] || ''}\t`,
      `Keyword 7\t${shuffledKeywords2[6] || ''}\t`
    );

    // Add image prompts for paperback if toggle is enabled
    if (includeImagePrompts) {
      data.push(
        `Image Prompt 1\t${parsedData.imagePrompts[0] || ''}\t`,
        `Image Prompt 2\t${parsedData.imagePrompts[1] || ''}\t`,
        `Image Prompt 3\t${parsedData.imagePrompts[2] || ''}\t`,
        `Image Prompt 4\t${parsedData.imagePrompts[3] || ''}\t`,
        `Image Prompt 5\t${parsedData.imagePrompts[4] || ''}\t`
      );
    }
    
    return data.join('\n');
  };

  const copyToClipboard = async () => {
    try {
      const formattedData = formatForGoogleSheets();
      await navigator.clipboard.writeText(formattedData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const downloadAsText = () => {
    const formattedData = formatForGoogleSheets();
    const blob = new Blob([formattedData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parsed-document.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalRows = includeImagePrompts ? 43 : 33;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Input Section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Paste Your Document Here:
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste your document content here..."
            className="w-full h-64 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Image Prompts Toggle */}
        <div className="mb-6 flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIncludeImagePrompts(!includeImagePrompts)}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              includeImagePrompts
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <SafeIcon icon={includeImagePrompts ? FiEye : FiEyeOff} />
            <SafeIcon icon={FiImage} />
            {includeImagePrompts ? 'Including Image Prompts' : 'Excluding Image Prompts'}
          </motion.button>
          <span className="text-sm text-gray-600">
            Toggle to include/exclude image prompts in the output
          </span>
        </div>

        {/* Parse Button */}
        <div className="flex justify-center mb-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={parseDocument}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <SafeIcon icon={loading ? FiZap : FiUpload} className={loading ? 'animate-pulse' : ''} />
            {loading ? 'Parsing with AI...' : 'Parse Document'}
          </motion.button>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2"
          >
            <SafeIcon icon={FiAlertCircle} />
            {error}
          </motion.div>
        )}

        {/* Results Section */}
        {parsedData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-t pt-6"
          >
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Parsed Results (Google Sheets Format - 3 Columns A, B, C)
            </h2>
            
            {/* Action Buttons */}
            <div className="flex gap-4 mb-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={copyToClipboard}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                  copied 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
              >
                <SafeIcon icon={copied ? FiCheck : FiCopy} />
                {copied ? 'Copied!' : 'Copy for Google Sheets'}
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={downloadAsText}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <SafeIcon icon={FiDownload} />
                Download
              </motion.button>
            </div>

            {/* Preview */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-gray-700 mb-3">Preview (Total: {totalRows} rows):</h3>
              <div className="text-sm text-gray-600 mb-3">
                • Row 1: Headers (Classification | Values | Selectors)<br/>
                • Rows 2-{includeImagePrompts ? 22 : 17}: Ebook version data<br/>
                • Rows {includeImagePrompts ? 23 : 18}-{totalRows}: Paperback version data (continuous, no duplicate headers)<br/>
                • <strong>New:</strong> 7 keywords total, different random selection for ebook vs paperback<br/>
                • <strong>New:</strong> AI LLM and AI Image Generator fields (same for both versions)<br/>
                • <strong>Image Prompts:</strong> {includeImagePrompts ? 'Included' : 'Excluded'} in output<br/>
                • <strong>Salesletter Detection Priority:</strong> 1) "SALESLETTER" (all caps) 2) "Amazon Book Description" 3) "Sales Copy" 4) HTML content
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="border border-gray-300 px-2 py-1 text-left font-medium">Classification</th>
                      <th className="border border-gray-300 px-2 py-1 text-left font-medium">Values</th>
                      <th className="border border-gray-300 px-2 py-1 text-left font-medium">Selectors</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-2 py-1 font-medium">Book Title</td>
                      <td className="border border-gray-300 px-2 py-1">{parsedData.bookTitle || 'Not found'}</td>
                      <td className="border border-gray-300 px-2 py-1"></td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-2 py-1 font-medium">Subtitle</td>
                      <td className="border border-gray-300 px-2 py-1">{parsedData.subtitle || 'Not found'}</td>
                      <td className="border border-gray-300 px-2 py-1"></td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-2 py-1 font-medium">Author First Name</td>
                      <td className="border border-gray-300 px-2 py-1">{parsedData.authorFirstName || 'Not found'}</td>
                      <td className="border border-gray-300 px-2 py-1"></td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-2 py-1 font-medium">Author Last Name</td>
                      <td className="border border-gray-300 px-2 py-1">{parsedData.authorLastName || 'Not found'}</td>
                      <td className="border border-gray-300 px-2 py-1"></td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-2 py-1 font-medium">HTML Salesletter</td>
                      <td className="border border-gray-300 px-2 py-1 text-xs max-h-16 overflow-y-auto">
                        {parsedData.htmlSalesletter || 'Not found'}
                      </td>
                      <td className="border border-gray-300 px-2 py-1"></td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-2 py-1 font-medium">Back Book Cover</td>
                      <td className="border border-gray-300 px-2 py-1 text-xs max-h-16 overflow-y-auto">
                        {parsedData.backBookCover || 'Not found'}
                      </td>
                      <td className="border border-gray-300 px-2 py-1"></td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-2 py-1 font-medium">AI LLM</td>
                      <td className="border border-gray-300 px-2 py-1">{parsedData.aiLlm || 'Not found'}</td>
                      <td className="border border-gray-300 px-2 py-1"></td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-2 py-1 font-medium">AI Image Generator</td>
                      <td className="border border-gray-300 px-2 py-1">{parsedData.aiImageGenerator || 'Not found'}</td>
                      <td className="border border-gray-300 px-2 py-1"></td>
                    </tr>
                    {[...Array(7)].map((_, i) => (
                      <tr key={`keyword-${i}`}>
                        <td className="border border-gray-300 px-2 py-1 font-medium">Keyword {i + 1}</td>
                        <td className="border border-gray-300 px-2 py-1">{parsedData.keywords[i] || 'Not found'}</td>
                        <td className="border border-gray-300 px-2 py-1"></td>
                      </tr>
                    ))}
                    {includeImagePrompts && [...Array(5)].map((_, i) => (
                      <tr key={`prompt-${i}`}>
                        <td className="border border-gray-300 px-2 py-1 font-medium">Image Prompt {i + 1}</td>
                        <td className="border border-gray-300 px-2 py-1 text-xs">{parsedData.imagePrompts[i] || 'Not found'}</td>
                        <td className="border border-gray-300 px-2 py-1"></td>
                      </tr>
                    ))}
                    <tr className="bg-yellow-50">
                      <td colSpan="3" className="border border-gray-300 px-2 py-1 text-center text-gray-500 italic">
                        ... Paperback version continues below with different keywords ({includeImagePrompts ? 21 : 16} more rows) ...
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Instructions */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-2">How to use in Google Sheets:</h3>
              <ol className="text-sm text-blue-700 space-y-1">
                <li>1. Toggle image prompts on/off as needed</li>
                <li>2. Click "Copy for Google Sheets" button above</li>
                <li>3. Open your Google Sheet</li>
                <li>4. Select cell A1</li>
                <li>5. Press Ctrl+V (or Cmd+V on Mac) to paste</li>
                <li>6. Data will fill 3 columns (A: Classification, B: Values, C: Selectors)</li>
                <li>7. Total of {totalRows} rows: 1 header + {includeImagePrompts ? 21 : 16} ebook + {includeImagePrompts ? 21 : 16} paperback</li>
              </ol>
              
              <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
                <h4 className="font-medium text-green-800 mb-2">New Features:</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• <strong>7 Keywords:</strong> Now extracts 7 keywords instead of 6</li>
                  <li>• <strong>Different Keywords:</strong> Ebook and paperback get different random keyword selections</li>
                  <li>• <strong>AI LLM:</strong> Random selection from Claude, Sonnet, ChatGPT, OpenAI, Gemini, Deepseek</li>
                  <li>• <strong>AI Image Generator:</strong> Random selection from Ideogram, ChatGPT, Imagen, Recraft, Canva, Midjourney</li>
                  <li>• <strong>Image Prompts Toggle:</strong> Include/exclude image prompts in output</li>
                  <li>• <strong>Same AI Tools:</strong> Both ebook and paperback versions use the same AI tools</li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        {/* Copyright */}
        <div className="mt-8 text-center text-sm text-gray-500 border-t pt-4">
          © Jay Gomz
        </div>
      </div>
    </div>
  );
};

export default DocumentParser;