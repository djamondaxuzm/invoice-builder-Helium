import { useEffect, useState, type RefObject } from 'react';
import { useAppDispatch } from '../../../state/configureStore';
import { setAllowed } from '../../../state/pageSlice';
import { formEqual } from '../../utils/formEqual';

export const useFormDirtyCheck = <T>(form: T | undefined, initialFormRef: RefObject<T | undefined>) => {
  const dispatch = useAppDispatch();
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!form || !initialFormRef.current) {
      setIsDirty(false);
      dispatch(setAllowed(true));
      return;
    }

    try {
      const dirty = !formEqual(initialFormRef.current, form);
      setIsDirty(dirty);
      dispatch(setAllowed(!dirty));
    } catch {
      setIsDirty(true);
      dispatch(setAllowed(false));
    }
  }, [dispatch, form, initialFormRef]);

  return isDirty;
};
