"use client"; // Only needed if using App Router
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Custom404() {
  const [cowsayOutput, setCowsayOutput] = useState('Loading cowsay...');

  useEffect(() => {
    // Import cowsay dynamically to avoid SSR issues
    import('cowsay').then((cowsay) => {
      const output = cowsay.say({
        text: 'aw dang it!',
        e: 'oo',  // eyes
        T: 'U '   // tongue
      });
      setCowsayOutput(output);
    }).catch((error) => {
      console.error('Failed to load cowsay:', error);
      setCowsayOutput('Failed to load cowsay library');
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-slate-800 flex items-center justify-center p-4">
      <div className="text-center max-w-md w-full">
        <h1 className="text-8xl font-bold text-white mb-8">404</h1>
        
        <div className="bg-black rounded-lg p-12 border border-gray-700 mb-8 shadow-xl w-full">
          <pre 
            className="text-green-400 whitespace-pre text-left"
            style={{
              fontFamily: 'Consolas, "Courier New", monospace',
              fontSize: '24px',
              lineHeight: '1.15',
              letterSpacing: '0',
              margin: 0,
              padding: 0,
              tabSize: 8
            }}
          >
            {cowsayOutput}
          </pre>
        </div>
        
        <p className="text-xl text-gray-300 mb-8">
          Page not found
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={() => window.history.back()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors duration-200 font-medium"
          >
            Go Back
          </button>
          <Link 
            href="/"
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors duration-200 inline-block font-medium"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}