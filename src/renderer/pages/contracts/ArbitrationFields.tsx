import { Checkbox, FormControlLabel, TextField, Typography } from '@mui/material';
import type { ContractDraft } from '../../../backend/shared/types/contracts';
import { newContractArbitration } from '../../../backend/shared/utils/contracts';

export const ArbitrationFields = ({
  value,
  disabled,
  onChange
}: {
  value: ContractDraft['arbitration'];
  disabled: boolean;
  onChange: (value: ContractDraft['arbitration']) => void;
}) => (
  <>
    <FormControlLabel
      label="Include binding arbitration"
      control={
        <Checkbox
          disabled={disabled}
          checked={Boolean(value)}
          onChange={(_, checked) => onChange(checked ? newContractArbitration() : null)}
        />
      }
    />
    {value && (
      <>
        <TextField
          label="Arbitration terms"
          multiline
          minRows={4}
          disabled={disabled}
          value={value.terms}
          onChange={event => onChange({ ...value, terms: event.target.value })}
        />
        <Typography variant="caption" color="text.secondary">
          The PDF prints a separate arbitration notice and blank initials for both parties. Existing contracts retain
          their saved terms and notice.
        </Typography>
      </>
    )}
  </>
);
