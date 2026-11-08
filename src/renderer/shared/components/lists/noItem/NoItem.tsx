import GridView from '@mui/icons-material/GridView';
import { Box, Typography } from '@mui/material';
import type { FC } from 'react';

interface Props {
  text: string;
  node?: React.ReactNode;
  icon?: React.ReactNode;
}

export const NoItem: FC<Props> = ({ text, node, icon = <GridView color="action" fontSize="large" /> }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        flexDirection: 'column',
        gap: 2,
        p: 3,
        textAlign: 'center',
        minWidth: 0
      }}
    >
      {icon}
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, overflowWrap: 'anywhere' }}>
        {text}
      </Typography>
      {node}
    </Box>
  );
};
