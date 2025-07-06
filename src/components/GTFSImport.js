import React, { useState } from 'react';
import { supabase } from '../services/supabase';

const GTFSImport = () => {
  const [file, setFile] = useState(null);
  const [networkName, setNetworkName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', content: '' });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/zip') {
      setFile(selectedFile);
      setMessage({ type: '', content: '' });
    } else {
      setFile(null);
      setMessage({ type: 'error', content: 'Please select a valid ZIP file' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !networkName.trim()) {
      setMessage({ type: 'error', content: 'Please provide both a network name and a GTFS file' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', content: '' });

    try {
      // Upload the GTFS file
      const fileExt = '.zip';
      const fileName = `${Date.now()}${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('gtfs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create a new network entry
      const { data: networkData, error: networkError } = await supabase
        .from('networks')
        .insert([
          {
            name: networkName,
            gtfs_file: fileName,
            status: 'pending'
          }
        ])
        .select();

      if (networkError) throw networkError;

      setMessage({ type: 'success', content: 'GTFS file uploaded successfully! Processing will begin shortly.' });
      setFile(null);
      setNetworkName('');
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', content: 'An error occurred while uploading the GTFS file' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-medium text-gray-900 mb-4">Import GTFS Data</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="networkName" className="block text-sm font-medium text-gray-700">
            Network Name
          </label>
          <input
            type="text"
            id="networkName"
            value={networkName}
            onChange={(e) => setNetworkName(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Enter network name"
          />
        </div>

        <div>
          <label htmlFor="gtfsFile" className="block text-sm font-medium text-gray-700">
            GTFS File (ZIP)
          </label>
          <input
            type="file"
            id="gtfsFile"
            accept=".zip"
            onChange={handleFileChange}
            className="mt-1 block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-indigo-50 file:text-indigo-700
              hover:file:bg-indigo-100"
          />
        </div>

        {message.content && (
          <div
            className={`p-4 rounded-md ${
              message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}
          >
            {message.content}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Uploading...' : 'Upload GTFS'}
        </button>
      </form>
    </div>
  );
};

export default GTFSImport; 