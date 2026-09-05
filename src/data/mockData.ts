import { GasStation, CommunityPost, ChatMessage, UserProfile, ConversionCenter } from '../types';
import pciStationsSeed from './pci-stations-seed.json';
import evStationsSeed from './ev-stations-seed.json';
import coreCngStationsSeed from './core-cng-stations-seed.json';
import pciConversionCentersSeed from './pci-conversion-centers-seed.json';

export const ASSETS = {
  logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBXr7CW16AX90XXUC1EdR0947RfRhBmIMe7HGiTWGlNAfGwTjlU7-lTNdNZOFmMx0hT2pos-9hloFXrn6tzhZhIqf5injkLdwnsrzdFuFOpGLExVMmNWBoJOehAzMklKXWRfnUIZBerlJrQZaEbobRnbD1qrprVK0us0AqOtuR6j_eVKDAiNidpATVWDBFDWlfe5xNtN-QwiBp6qL5hm_qWsn0qJSjPsewJfcTmRzpoX1oYPchl_69f5g',
  userAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD7xFFR2C9kpy2vVrPaglu8tSaJ2yPvSNma0VnfEFhkFAoGhw0k7eabmD26I9I8Uit2q_G3FPTA2zP6Fn4xm-c3vwzIGjQKmI8O9bNRyi8izC6LVo_gcmkkd22f6HhmFyuyGEBzpXMBB0BnqqSQ238Js13aC7eer1NGIe4g7LogNDFixISR2Ak95DAeMZuRNFTDDbjfX1Q9vcxp5o0bbCh5ktVaqn-RWIQWcFXhT7wvTjJvm3mvGdDaaA',
  onboardingIllustration: 'https://lh3.googleusercontent.com/aida/AP1WRLsJjFzQoG75Jq83Z403b2n8',
  evSideProfile: 'https://lh3.googleusercontent.com/aida/AP1WRLu_N',
  lagosMap: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDsiVOFvqz971wSOAftqcYFdOkgbTRWuYY70qxsxTqTCdcRUdE6GEGs-viRukOoowE1tCYD_A9KR6kTkBUW1aBZzsKA3o3H7Y62Z0wsrZWOREe_a27XONXQ6gzmkHVKXjkBMo1madFKC9v-beJFdh4GO4fKAB_5BMa0sGjYw85o8RPhkjGU_5EyutOk6h_eMyKzGf7w-gc6UB5xECKlsepu-PCKw-_XWcjiGCxbKKQ2zIykv6VqY5u8pw',
  abujaMap: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAR9KEvDgGDcRWMz3ZBy1F1m-YrxxUJt75EMHU6k9WaWY0DxmA2F024FqprTG-OE3zHaCmM6mY_iRPdwOvm2ty2amwbzQB76EBev5B7F36zYhlwAOLwanFj63hmCMdHnDjqoh75PVXnFKr11P-DcN_HAypcboHQmMZr0bl7bI1GcrkMpj_cBIlGser2-O3re2pat_S2isHvSoa7Xad0AjezB5ZP9gEfnZUcu-4c1hIa_GCAEAmfRZ8Mlw',
  notificationMap: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAOCk3ll_LFFVoMdGMqFtUsm7yx1rUizLGquZwqhthVa9_k7PwZvtyiQa0Ucv5dwNP7dZz7MHSRDQgR-mjDEc1DXR383vtZbpX-jnIfLJYDLbzQOlf-ZYH0akRaVUPntXfu6Z4iHiHSNHBD4sdOb-wiFLwMxfdMWjG3f4luYxQABSc7VwEjH2QnWu6g7rgjvYyhPU3HsjZ0vaixE-7lUozFKjdXv5DXVfUYh9tzjs3WwfVNaY_loRY7Vw',
  appIcon: 'https://lh3.googleusercontent.com/aida/AP1WRLtDnWqhUmTB-pFi4lwU5KWNqd2AxToGewN_NqF_cW3WX58kfAGJWviGN4KKsmhHJWYfELcF91z-IlI1ghQg4dkfjmpIHyW3p97mllihWM2ja0baDe6a438jxj4cJEDFzDP-0S_-nS3xVT-YPUNTWj_Wd0HjgEVQifOXh7x3RggoMSa9vz_JpJ_ZD1lsavuVBKPBQpsfGKGzPHuDHUZ8ZOcdiNG4t49-WIrmMkojzO6YikyAIYihaSO63Sg',
  
  // Cars and stations
  hondaAccord: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBbsStUrJOxcO9I71qp_OegCqZcPXv1utfn7s_Qdv2JM1IBVvwbAebaH2xuR9L2Lq9Fj1GU0dFZmPe3Fr0VFXbYZQjKElkrvbNpHVnhktTvd_SdIHwI0D-gaxY6Enlotz0bcIQNpxB59phRYLPdix6BbOZymXHLPGdEtBt1kmU8YhUHL_6d68TpgIanHwdr8QQn9Q4gXHtcMOvbMgdGOEtEarmI996lIDlsHifiHHfKoc28OOWM3MRNjA',
  toyotaCamryListing: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC5bqs244DU_1S9IRkatzUjOsMiXPbnvf8l2Iz4s36T2cjpbaiGoaGgDOLCuT2xsifyroMKLxkK407-J_1zngSPuApJIn-fG25Hdy9xy8J5YHn30kx2Z6rRPbJFRQ3DM_lWhOardE7Z5uLDAI8gCg8-xntlrnMmkP7G__t-HO9Nvw5343A8EqTOSamqSFf5N9hBk6Iu8kiCWzuh0FTavWkrLQJR50F1ICnfsj2WA3MMcWPD-jDw-bjMKQ',
  cngEngineBay: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDG9dqoCFahHAw8dKIs3zCE4GPTnHvWNt3mLDcTtAs8tfUsBe-lH4X9gIOqjLhKFA-e_POC6GCHhjvU-N2H3S-l42mwXupDReH6MjyByL-aCWQWdrXJMQrgA3A1tb0i0xDQ0odKXx5ygrhPkFbVI0ZxPsc-7JH9yzPm9ZQhsjsiOqqv7mkhDgV__R-Ci7wlJFoxB1mg2FHr6dCGIgVYLG1cJzuoser6xwdnv0nzLXMDY32KR1J-YtDHGg',
  lekkiConstruction: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAE960QMQKMNP3_CsTDIEiaNT0McvAq08k3D0vabK3LWP948UWiVhNWQnhKKzQU1bnOeRG9m7gNZRDu02VPHs_srbH_A6cQj3U4D1P6MTlDBv-ihi4PHNrInA9YlpsoYYAQcQrsNlnHqRZGTQY38tkV9i1HStMWUZ92RZuI-O3-A8ggIe0vCr5mjJuOndbIQafwRgwmNSkc4TWj66lIxg2ukqTt23suXAgtAhl9JY7q6IQF9JJsaIfo8g',
  
  // Station images
  pumpMeter: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCGz7yCkOImhIoCM5I_EINxD7dBxE6nqJFTXGougPhIkU5hAkLa41CKWC5xZhDtI6BLlB-C243LNNu3XQJ5ixIf172iotWhGR4RTxofAc-4CrKgar812vNHIjYZb5YDu7D6OwatXNcyg8Hpjcjf4AUrQpl92XZIIc1OCB5QeuZSiHKNwRKSUQvObae0c_AgcwxiIcZyb94YB_NAIhdyV3leFoRxwyRjtsTAHi5slkfhBMxH3pD5ZwKT9g',
  stationWide: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDWTm8LOfzUHI1cp-7bm_y_cpG-e1fxUB0eNQsYhZZfdGMhktBnFQtzyZjuPKR15rk7xTNiua_yZX4-cmtj1RteVzm7TWUm_LMwbfOKGG5moxIa3gtupAnRzLwVmp_6JWx6qAO_me0LE0reA43qwgmffq92bUPt6nXh_tPCmjiLDZzfS0iD4BDzP00gxE5u2nTm-Awxh9cK2GKlijcon-G8wsQprTYT2r95vhil-jdmM-j8x8nKqo7w6A',
  fuelNozzle: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCxLVxfXecDTGN23_sy7XWxKSUbFOZ1f1LJ2gZBoH5j6Hrlp2z5IyrBbBUir1vlQ5Ljt23pCSICk7AanbOp8u0LdyhqBnrHa9X6Xq312y5NyvDfBC1_jVPmUyQ7R0GLUI6UpY_2T97mkC8Mv7ZueYZuMNFATNkeTSdE7zDNWApOLQZp8JXaSk7Fc4L1YlsfeZpD0weQEpsqILmtLWkiQOY1eGACX_75KDPwzCNK5YdxIARJT8LhVNH06g',
  pumpBlurred: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA5IeBNzjY659YIv6cHMfrdO9zgVXgPzv9DNtQ6TNpRDQ36FCrxKKMEZ6s18jvEl_JWJPRyxuRv65T5Glg_cpYm7pH35T6_Y0OOlQgqan7Y5h7AznjZZYOeug-jM6weh_FzFW7VP9e1lwS9byUU5oKjdDuWZpJMZkUupDWv8L5qhopII1VC--31uJe4CNS3rZdeYX5yNwrJYA_A0A8O9lYhwNCHvNUAZYGooIeB8QKi8T-Wh3nl_4JCug',
  dispenserGreen: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDb50I-qtZ_zQCfWKAKpTTne1SajLnORSjz8C24jvdgKxuRmItOUXivosWbnHPzO3CRja4KGiEuH5ZteqwYmNaUngpcOv7yqLz2kMiZoseQodUupIWdlmwpx3hFd83qyqPYAXO-70qc-G_BMW1PxFq78Gx51V3Mww8mcm0aAMAqvIWS9Fz-JBhGGAh-rDAaotkoDJK8yNmJFjO5NoO2E9ilGeW01eozw9hUDksSoYrkIXOkLzRfpvIdqQ',
  totalCanopy: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCK8bVgER_NJ7TVRNJuVZ0BgFX-3BmwMqovAMygE936j92pHmMU8zqqx9Dkqk5QRRhkzF9JFz1P3f2DXGMb5ui_hxn-D4qrBzoDaMiswBclC8qRaYWrD8Kz7rkrqQkUWCjH411qviUxcKi7ux3B2S-e-szK_bSMu44N6dTfwagWUXeXTOPkljaz592plVFik5K0Q1xiFK_BECCebz7QknxQC7r9UN7pNWJg716fZ8SmdmE1qFBJy7cYpQ',

  // Avatars
  emmanuelAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC_ge0P8czyljdFKeWsccnNGqGguIjTgQhWnhei-zRfDSRFbCalzT7DsgPyUXo00Crb6laEPN7R_QF7YDeCBnUcefva0AO0cj96PofZHsJ_1CzS7werWdVOFUOFdlwZNTuJfCUjQDf8RUizSg-bNRvCH1PuR7Meg7dAlBzoV9XpqLCUM2pQdm91Q2fyNYItDfdW6QLT4nUvN1T1c-1eZZpHPTNhrYyitC6OYXGL0bDqFJT4NeezrIc-sw',
  davidAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBuIqjFNqI5kSxh5Xg921urqAzblb1F7vl5_z2Hq-bnsI33LNkQHhzw48vIec1om5ZnKtiZmSP4nY0UD3tlkcLfx0Qb6OV4v-ry-7w80kqNbKiIYB0QFwt1o015QQJiMNK_APM1GHaGgqQoqUw1RB4uCM1-X10o_I_tAD5U7-9jpyoOAR6ecWVXLYeBbcD-Qq1UEIQQ-sMF64lQ72-jBPnjQsPlAPIrXdxdrJmvi5_4kRNgBncJlX50gQ',
  ngoziAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCthbGkCYJ9vWVGNxGHNQT6zspUDL4s4PbzP0NrKNwmKhEbNWN2th6TybIoPhjumDtviShttJrSyGXMgouainlECxYiV8LZIJkVYb9vs1QcKovXiWi9GJDIu6PICJ4SjB1T_7IqMow0aNEo6YBeB6G-lUbh7a_ah3ytVoU0xnzOOR4HL3tfYcbdjEbSaQn2khpdx3lmWEUJACt6IDR-HxjCXfqgC-ZF1SUfuqsRWjUm_tY-uOcYObnsQQ',
  babaAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDiUnP0pK8DVoKWVkUACMFR1TR2a93IKaPnVcCjg9EJmHQRta89jNOoKFDUNXi0ovAHCRLckZpu-8Y3hGQc2a_n5akRROWMtNOR7n-oDxSlqFLQj5JhK99W5PwyEeY6o7uw2ygAEqYXNBA8RiHUqc-uafg2UaCq_xQjhAy08IThCUc55zdVbBtn6iAZDuMexIj_HEwkj2poLtK9hbPA6E0zRYT8YNqDSiJSVxzlj80IfeWVRS3Hwme0Ww',
  obinnaAvatar: 'https://lh3.googleusercontent.com/aida/AP1WRLstYhXGdURaCPqJ8IpPjRHxu7QQsJGxj8CqEoc38bQI_bILdUtOpVj04BEDm0GvdMu8o0OLSaWi6vKdcpVux6DBqzdnLvR1OABNzZmSfBegMy1URwLhmbaICelUb3fMSiu9faEPsJuzWpkjwNhY-mO9sdeHX16QrEcqjzjzK9VRNFL9U9qGbGPfAodLnAu43Pg0NvISU8kK8gzrl1a0cfjYrE1pqZtpzEjc76oSL7HyCYOza8mddyLtcE-l',
};

// Empty placeholder profile: the shape the app renders before a real
// Supabase session resolves (and the fallback avatar for rows with none).
// Not a real identity — every field is blank/zero until sign-in loads the
// driver's actual `profiles` row.
export const INITIAL_USER: UserProfile = {
  name: '',
  phone: '',
  email: '',
  avatar: ASSETS.userAvatar,
  vehicle: '',
  cngInstalledDate: '',
  monthlySavings: 0,
  reportsCount: 0,
  reputationScore: 0,
  communityPoints: 0,
  state: undefined,
};

export function deduplicateStations(stationsList: GasStation[]): GasStation[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  return stationsList.filter((st) => {
    const idKey = st.id;
    const normName = st.name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    if (seenIds.has(idKey) || seenNames.has(normName)) {
      return false;
    }
    seenIds.add(idKey);
    seenNames.add(normName);
    return true;
  });
}

export const INITIAL_STATIONS: GasStation[] = deduplicateStations([
  ...(evStationsSeed as GasStation[]),
  ...(coreCngStationsSeed as GasStation[]),
  ...(pciStationsSeed as GasStation[]).map((s) => ({ ...s, stationType: (s.stationType || 'cng') as 'cng' })),
]);

export const INITIAL_COMMUNITY_POSTS: CommunityPost[] = [];

export const INITIAL_POSTS = INITIAL_COMMUNITY_POSTS;

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [];

export const INITIAL_CONVERSION_CENTERS: ConversionCenter[] = pciConversionCentersSeed as ConversionCenter[];
