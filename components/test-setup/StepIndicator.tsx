'use client';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepTitles: string[];
}

export default function StepIndicator({ currentStep, totalSteps, stepTitles }: StepIndicatorProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {stepTitles.map((title, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;

          return (
            <div key={stepNumber} className="flex items-center flex-1">
              {/* ステップサークル */}
              <div className="flex items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all
                    ${
                      isCompleted
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : isActive
                        ? 'bg-white border-blue-600 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-400'
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </div>
                
                {/* ステップタイトル（モバイルでは非表示） */}
                <div className="ml-3 hidden sm:block">
                  <div
                    className={`text-sm font-medium ${
                      isActive ? 'text-blue-600' : isCompleted ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {title}
                  </div>
                </div>
              </div>

              {/* 接続線 */}
              {stepNumber < totalSteps && (
                <div
                  className={`
                    flex-1 h-0.5 mx-4 transition-all
                    ${isCompleted ? 'bg-blue-600' : 'bg-gray-200'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* モバイル用の現在のステップタイトル */}
      <div className="sm:hidden mt-4 text-center">
        <div className="text-sm text-gray-500">
          ステップ {currentStep} / {totalSteps}
        </div>
        <div className="text-lg font-medium text-gray-900">
          {stepTitles[currentStep - 1]}
        </div>
      </div>
    </div>
  );
}