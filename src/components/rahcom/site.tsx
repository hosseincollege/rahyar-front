import { RahcomInformation, type RahcomInformationProps } from './information';

/** Compact site summary used by site row information popups. */
export function RahcomSite(props: RahcomInformationProps) {
  return <RahcomInformation {...props} />;
}
