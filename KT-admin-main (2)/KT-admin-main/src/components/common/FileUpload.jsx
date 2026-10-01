import React, { useState } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';

export const FileUpload = ({
  label,
  accept = ".pdf,.doc,.docx,.jpg,.png",
  maxSizeMB = 5,
  onFileSelect,
  required = false,
  error,
  helperText,
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`File size exceeds limit of ${maxSizeMB}MB`);
      return;
    }
    setSelectedFile(file);
    if (onFileSelect) onFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (onFileSelect) onFileSelect(null);
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          {label}
          {required && <span className="text-secondary ml-1">*</span>}
        </label>
      )}

      {selectedFile ? (
        <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="flex items-center space-x-3 truncate">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <p className="text-xs font-medium text-gray-900 truncate">{selectedFile.name}</p>
              <p className="text-[11px] text-gray-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
          </div>
          <button
            type="button"
            onClick={removeFile}
            className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all duration-200 ${
            isDragging
              ? 'border-primary-600 bg-primary-50/20'
              : error
              ? 'border-red-300 bg-red-50/20'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <input
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center justify-center space-y-1.5">
            <div className="p-2.5 bg-gray-100 rounded-full text-gray-600">
              <UploadCloud className="w-5 h-5" />
            </div>
            <p className="text-xs font-medium text-gray-700">
              <span className="text-primary font-semibold hover:underline">Click to upload</span> or drag and drop
            </p>
            <p className="text-[11px] text-gray-400">PDF, DOC, PNG, JPG up to {maxSizeMB}MB</p>
          </div>
        </div>
      )}

      {error ? (
        <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-gray-500">{helperText}</p>
      ) : null}
    </div>
  );
};

export default FileUpload;
