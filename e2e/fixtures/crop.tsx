import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { CropModal } from '../../src/renderer/shared/components/modals/cropModal/CropModal';
import '../../src/renderer/i18n';

const size = new URLSearchParams(location.search).get('size') || 'wide';
const [width, height] = size === 'tall' ? [1000, 4000] : size === 'small' ? [32, 24] : [4000, 1000];
const canvas = document.createElement('canvas');
canvas.width = width;
canvas.height = height;
const ctx = canvas.getContext('2d')!;
ctx.fillStyle = '#28b7b1';
ctx.fillRect(0, 0, width, height);
ctx.fillStyle = 'white';
ctx.beginPath();
ctx.arc(width / 2, height / 2, Math.min(width, height) / 4, 0, Math.PI * 2);
ctx.fill();
const source = canvas.toDataURL('image/png');
const Fixture = () => {
  const [open, setOpen] = useState(true);
  const [result, setResult] = useState('');
  return (
    <>
      <CropModal
        imageSrc={source}
        isOpen={open}
        onClose={() => setOpen(false)}
        onSave={url => {
          const image = new Image();
          image.onload = () => {
            setResult(image.naturalWidth + 'x' + image.naturalHeight);
            setOpen(false);
          };
          image.src = url;
        }}
      />
      <output>{result}</output>
    </>
  );
};
createRoot(document.getElementById('root')!).render(<Fixture />);
