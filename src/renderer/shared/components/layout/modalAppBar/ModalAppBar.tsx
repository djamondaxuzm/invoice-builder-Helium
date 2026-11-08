import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { AppBar, Box, Button, IconButton, Toolbar, Tooltip, Typography, useTheme } from '@mui/material';
import { type FC, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  title?: string;
  formData?: unknown;
  description?: string;
  isFormValid: boolean;
  onClose?: () => void;
  onSave?: (data: unknown) => void;
  renderCustomButtons?: () => ReactNode;
}
export const ModalAppBar: FC<Props> = ({
  title,
  formData,
  description,
  isFormValid,
  onClose = () => {},
  onSave = () => {},
  renderCustomButtons = () => null
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <AppBar
      elevation={0}
      color="default"
      sx={{
        position: 'relative',
        borderRadius: 0,
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'divider'
      }}
    >
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, py: 1 }}>
        <Tooltip title={t('ariaLabel.back')}>
          <IconButton
            onClick={onClose}
            aria-label={t('ariaLabel.back')}
            sx={{
              color: theme.palette.text.secondary
            }}
          >
            <ArrowBackIcon fontSize="medium" />
          </IconButton>
        </Tooltip>

        {title && (
          <Typography variant="h5" component="h2" sx={{ flexGrow: 1, overflowWrap: 'anywhere' }}>
            {title}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          {renderCustomButtons()}
          <Tooltip
            title={!isFormValid && description ? description : ''}
            disableHoverListener={isFormValid}
            disableFocusListener={isFormValid}
            disableTouchListener={isFormValid}
          >
            <Box>
              <Button
                autoFocus
                variant="contained"
                onClick={() => {
                  if (formData !== undefined) onSave(formData);
                }}
                disabled={!isFormValid}
              >
                {t('common.save')}
              </Button>
            </Box>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
