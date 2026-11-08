import { createTheme, type PaletteMode, type ThemeOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    customBorder?: string;
  }
  interface PaletteOptions {
    customBorder?: string;
  }
}

const commonSettings: ThemeOptions = {
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, fontSize: '2rem' },
    h2: { fontWeight: 600, fontSize: '1.75rem' },
    h4: { fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.35 },
    h5: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.4 },
    h6: { fontWeight: 600, fontSize: '1.0625rem', lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 600 }
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8, minHeight: 36 }, sizeSmall: { minHeight: 32 } }
    },
    MuiToggleButton: {
      styleOverrides: { root: { textTransform: 'none', fontWeight: 600, padding: '6px 16px' } }
    },
    MuiToggleButtonGroup: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 12 } } },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { backgroundImage: 'none' } }
    },
    MuiDialogTitle: { styleOverrides: { root: { fontSize: '1.25rem', fontWeight: 600 } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '16px 24px', gap: 8, flexWrap: 'wrap' } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
    MuiTableCell: {
      styleOverrides: { head: ({ theme }) => ({ backgroundColor: theme.palette.action.hover, fontWeight: 600 }) }
    }
  }
};

const appTheme = (mode: PaletteMode) => {
  const dark = mode === 'dark';
  const track = dark ? '#20252d' : '#edf0f5';
  const thumb = dark ? '#616e80' : '#a1adbc';
  // Preserve shared controls while deriving the palette from the selected mode.
  return createTheme({
    ...commonSettings,
    palette: {
      mode,
      primary: { main: dark ? '#90caf9' : '#1976d2' },
      secondary: { main: dark ? '#ce93d8' : '#9c27b0' },
      background: { default: dark ? '#12161c' : '#f5f6fa', paper: dark ? '#1c222b' : '#ffffff' },
      text: { primary: dark ? '#edf2f7' : '#202936', secondary: dark ? '#b0bdcd' : '#566477' },
      divider: dark ? '#354050' : '#dce2eb',
      customBorder: dark ? '#354050' : '#dce2eb'
    },
    components: {
      ...commonSettings.components,
      MuiCssBaseline: {
        styleOverrides: {
          '*': {
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': { width: 10, height: 10 },
            '&::-webkit-scrollbar-track': { background: track, borderRadius: 5 },
            '&::-webkit-scrollbar-thumb': { backgroundColor: thumb, border: `2px solid ${track}`, borderRadius: 5 },
            scrollbarColor: `${thumb} ${track}`
          }
        }
      }
    }
  });
};

export const lightTheme = appTheme('light');
export const darkTheme = appTheme('dark');
