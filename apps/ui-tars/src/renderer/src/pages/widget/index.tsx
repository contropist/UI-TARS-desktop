import { useStore } from '@renderer/hooks/useStore';
import { Monitor, Globe, Pause, Play, Square } from 'lucide-react';
import { actionIconMap } from '@renderer/components/ThoughtChain';
import { useSetting } from '@renderer/hooks/useSetting';

import logo from '@resources/logo-full.png?url';
import { Button } from '@renderer/components/ui/button';
import { useCallback, useMemo, useState } from 'react';
import { api } from '@renderer/api';

import './widget.css';

const getOperatorIcon = (type: string) => {
  switch (type) {
    case 'nutjs':
      return <Monitor className="h-3 w-3 mr-1.5" />;
    case 'browser':
      return <Globe className="h-3 w-3 mr-1.5" />;
    default:
      return <Monitor className="h-3 w-3 mr-1.5" />;
  }
};

const getOperatorLabel = (type: string) => {
  switch (type) {
    case 'nutjs':
      return 'Computer';
    case 'browser':
      return 'Browser';
    default:
      return 'Computer';
  }
};

const Widget = () => {
  const { messages = [], errorMsg } = useStore();
  const { settings } = useSetting();

  const currentOperator = settings.operator || 'nutjs';

  const lastMessage = messages[messages.length - 1];

  const currentAction = useMemo(() => {
    if (!lastMessage) return [];

    if (lastMessage.from === 'human') {
      return [
        {
          action: 'Screenshot',
          type: 'screenshot',
          cost: lastMessage.timing?.cost,
        },
      ];
    }

    return (
      lastMessage.predictionParsed?.map((item) => {
        const input = [
          item.action_inputs?.start_box &&
            `(start_box: ${item.action_inputs.start_box})`,
          item.action_inputs?.content && `(${item.action_inputs.content})`,
          item.action_inputs?.key && `(${item.action_inputs.key})`,
        ]
          .filter(Boolean)
          .join(' ');

        return {
          action: 'Action',
          type: item.action_type,
          cost: lastMessage.timing?.cost,
          input: input || undefined,
          reflection: item.reflection,
          thought: item.thought,
        };
      }) || []
    );
  }, [lastMessage]);

  const [isPaused, setIsPaused] = useState(false);

  const handlePlayPauseClick = useCallback(async () => {
    if (isPaused) {
      await api.resumeRun();
    } else {
      await api.pauseRun();
    }
    setIsPaused((prev) => !prev);
  }, [isPaused]);

  const handleStop = useCallback(async () => {
    await api.stopRun();
  }, []);

  return (
    <div className="w-80 h-80 overflow-hidden p-4 bg-white/90 dark:bg-gray-800/90">
      <div className="flex">
        {/* Logo */}
        <img src={logo} alt="logo" className="-ml-2 h-6 mr-auto" />
        {/* Mode Badge */}
        <div className="flex justify-center items-center text-xs border px-2 rounded-full text-gray-500">
          {getOperatorIcon(currentOperator)}
          {getOperatorLabel(currentOperator)}
        </div>
      </div>

      {!!errorMsg && <div>{errorMsg}</div>}

      {!!currentAction.length && !errorMsg && (
        <>
          {currentAction.map((action, idx) => {
            const ActionIcon = actionIconMap[action.type];
            return (
              <div
                key={idx}
                className="mt-4 max-h-54 overflow-scroll hide_scroll_bar"
              >
                {/* Actions */}
                {!!action.type && (
                  <>
                    <div className="flex items-baseline">
                      <div className="text-lg font-medium">Actions</div>
                      {/* {action.cost && (
                        <span className="text-xs text-gray-500 ml-2">{`(${ms(action.cost)})`}</span>
                      )} */}
                    </div>
                    <div className="flex items-center text-gray-500 text-sm">
                      <ActionIcon className="w-4 h-4 mr-1.5" strokeWidth={2} />
                      <span className="text-gray-600">{action.type}</span>
                      {action.input && (
                        <span className="text-gray-600 break-all truncate">
                          {action.input}
                        </span>
                      )}
                    </div>
                  </>
                )}
                {/* Reflection */}
                {!!action.reflection && (
                  <>
                    <div className="text-lg font-medium mt-2">Reflection</div>
                    <div className="text-gray-500 text-sm break-all">
                      {action.reflection}
                    </div>
                  </>
                )}
                {/* Thought */}
                {!!action.thought && (
                  <>
                    <div className="text-lg font-medium mt-2">Thought</div>
                    <div className="text-gray-500 text-sm break-all">
                      {action.thought}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </>
      )}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePlayPauseClick}
          className="h-8 w-8 border-gray-400 hover:border-gray-500 bg-white/50 hover:bg-white/60"
        >
          {isPaused ? (
            <Play className="h-4 w-4" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleStop}
          className="h-8 w-8 text-red-400 border-red-400 bg-white/50 hover:bg-red-50/80 hover:text-red-500"
        >
          <Square className="h-4 w-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
};

export default Widget;
