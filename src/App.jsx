import React, { useState } from 'react';
import DocumentParser from './components/DocumentParser';
import './App.css';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Document Section Parser
          </h1>
          <p className="text-gray-600">
            Parse your document and format it for Google Sheets
          </p>
        </header>
        <DocumentParser />
      </div>
    </div>
  );
}

export default App;