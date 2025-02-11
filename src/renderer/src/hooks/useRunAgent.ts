/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { useToast } from '@chakra-ui/react';
import { useDispatch } from '@renderer/hooks/useDispatch';

import { Conversation } from '@ui-tars/shared/types';

import { useStore } from '@renderer/hooks/useStore';

import { usePermissions } from './usePermissions';
import { useSetting } from './useSetting';

export const useRunAgent = () => {
  const dispatch = useDispatch();
  const toast = useToast();
  const { settings } = useSetting();
  const { messages } = useStore();
  const { ensurePermissions } = usePermissions();

  const run = (value: string, callback: () => void = () => {}) => {
    if (
      !ensurePermissions?.accessibility ||
      !ensurePermissions?.screenCapture
    ) {
      const permissionsText = [
        !ensurePermissions?.screenCapture ? 'screenCapture' : '',
        !ensurePermissions?.accessibility ? 'Accessibility' : '',
      ]
        .filter(Boolean)
        .join(' and ');
      toast({
        title: `Please grant the required permissions(${permissionsText})`,
        position: 'top',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    // check settings whether empty
    const settingReady = settings?.vlmBaseUrl && settings?.vlmModelName;

    if (!settingReady) {
      toast({
        title: 'Please set up the model configuration first',
        position: 'top',
        status: 'warning',
        duration: 2000,
        isClosable: true,
        onCloseComplete: () => {
          dispatch({
            type: 'OPEN_SETTINGS_WINDOW',
            payload: null,
          });
        },
      });
      return;
    }

    const initialMessages: Conversation[] = [
      {
        from: 'human',
        value,
        timing: {
          start: Date.now(),
          end: Date.now(),
          cost: 0,
        },
      },
    ];

    dispatch({ type: 'SET_INSTRUCTIONS', payload: value });

    dispatch({
      type: 'SET_MESSAGES',
      payload: [...messages, ...initialMessages],
    });

    dispatch({ type: 'RUN_AGENT', payload: null });

    callback();
  };

  return {
    run,
  };
};
