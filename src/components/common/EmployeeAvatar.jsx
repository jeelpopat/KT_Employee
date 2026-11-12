import React, { useState } from 'react';
import companyLogo from '../../assets/Logo.png';

const PHOTO_FIELDS = [
  'profilePhoto',
  'profileImage',
  'profileImg',
  'photoUrl',
  'avatar',
  'imageUrl',
  'image',
  'photo',
  'secure_url',
  'url',
];

const NESTED_PROFILE_FIELDS = ['employee', 'user', 'profile', 'employeeId', 'userId', 'employeeID', 'userID'];

const isImageUrl = (value) =>
  /^(https?:|data:image\/|blob:|\/\/|\/|\.\.?\/)/i.test(value) ||
  /\.(png|jpe?g|gif|webp|svg)([?#].*)?$/i.test(value);

const findPhotoUrl = (value, visited = new Set()) => {
  if (!value) return '';
  if (typeof value === 'string') {
    const candidate = value.trim();
    return isImageUrl(candidate) ? candidate : '';
  }
  if (typeof value !== 'object' || visited.has(value)) return '';
  visited.add(value);

  for (const field of PHOTO_FIELDS) {
    const candidate = value[field];
    if (typeof candidate === 'string' && isImageUrl(candidate.trim())) return candidate.trim();
    if (candidate && typeof candidate === 'object') {
      const nestedUrl = findPhotoUrl(candidate, visited);
      if (nestedUrl) return nestedUrl;
    }
  }

  for (const field of NESTED_PROFILE_FIELDS) {
    const nestedUrl = findPhotoUrl(value[field], visited);
    if (nestedUrl) return nestedUrl;
  }
  return '';
};

export const EmployeeAvatar = ({
  employee,
  user,
  profile,
  src,
  alt = 'Employee profile',
  className = '',
}) => {
  const photoUrl = findPhotoUrl(src) ||
    findPhotoUrl(employee) ||
    findPhotoUrl(user) ||
    findPhotoUrl(profile);
  const [failedPhotoUrl, setFailedPhotoUrl] = useState('');
  const showCompanyLogo = !photoUrl || failedPhotoUrl === photoUrl;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ${className}`}
      role="img"
      aria-label={alt}
    >
      <img
        src={showCompanyLogo ? companyLogo : photoUrl}
        alt={showCompanyLogo ? 'Kevalon Technology logo' : alt}
        onError={() => {
          if (photoUrl) setFailedPhotoUrl(photoUrl);
        }}
        className={`h-full w-full ${showCompanyLogo ? 'object-contain p-[18%]' : 'object-cover'}`}
      />
    </span>
  );
};