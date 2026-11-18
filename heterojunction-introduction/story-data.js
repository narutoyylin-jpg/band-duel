(() => {
  const scenes = [
    {
      id: 'overview', duration: 12000,
      cn: {
        name: '異質接面',
        headline: ['能帶位差，改變', '電子與電洞的去向。'],
        lede: '半導體異質接面能讓電子與電洞侷限在同一區域，或分居接面兩側。關鍵在導帶與價帶如何錯開。',
        beats: ['Type I 的薄層結構，讓兩種載子偏向中間。', '改變價帶排列，電洞偏好的位置也跟著改變。', 'Type II 讓電子與電洞偏向接面的不同側。'],
        detail: [
          '兩種不同半導體相接的交界稱為異質接面。它們的導帶底 Ec 與價帶頂 Ev 可能有能量落差，分別稱為導帶位差與價帶位差。',
          '電子通常偏向較低的導帶底；電洞通常偏向較高的價帶頂。兩個有利位置可在同一種材料，也可分屬不同材料。這些偏好是在其他條件相近時比較，並不表示所有載子都只留在一側。',
          'Type I 配合 A／B／A 等有限薄層及兩側能障，可形成載子侷限；Type II 則能促進電子與電洞的空間分離。圖中的動線與載子數量均為示意。'
        ]
      },
      en: {
        name: 'Heterojunctions',
        headline: ['Band offsets shape', 'where carriers go.'],
        lede: 'Semiconductor heterojunctions can confine electrons and holes together or separate them across an interface, depending on their conduction- and valence-band offsets.',
        beats: ['A Type I thin-layer structure favors both carriers in its middle.', 'Change the valence alignment, and the favorable hole location changes.', 'Type II favors electrons and holes on opposite sides of the interface.'],
        detail: [
          'A heterojunction is an interface between two different semiconductors. Their conduction-band minima Ec and valence-band maxima Ev can have energy discontinuities: the conduction- and valence-band offsets.',
          'Electrons generally favor the lower conduction edge; holes favor the higher valence edge. These favorable locations can lie in the same material or in different materials. Other conditions are held similar in this comparison; a preference does not place every carrier on one side.',
          'A Type I arrangement with a finite layer and barriers on both sides, such as A/B/A, can provide confinement. Type II can promote spatial separation. The paths and carrier counts shown are schematic.'
        ]
      }
    },
    {
      id: 'bands', duration: 10000,
      cn: {
        name: '價帶與導帶',
        headline: ['價帶與導帶，都是', '允許電子佔據的能量範圍。'],
        lede: '以理想、未摻雜半導體的 0 K 狀態辨認：價帶是最高的填滿能帶，導帶是它上方下一段允許能帶。',
        beats: ['價帶與導帶之間，是沒有可用能態的能隙。', '電子吸收足夠能量，可以從價帶進入導帶。', '導帶多一顆電子，價帶留下一個電洞。'],
        detail: [
          '固體裡有大量相鄰的允許電子能態，形成一段段能帶。能帶是能量範圍，不是材料裡兩個不同的實體區域；這張圖的上下表示電子能量，左右才是位置。',
          '在理想、未摻雜半導體的 0 K 狀態，價帶是最高的完全填滿能帶；導帶是緊接在它上方、原本空著的允許能帶。Ec 是導帶底，Ev 是價帶頂。兩者之間的能隙 Eg 沒有可用能態。',
          '電子獲得足夠能量可躍遷到導帶，在價帶留下空位，也就是電洞。有電洞時，其他價帶電子接連填補空位，也能形成電流。光激發動畫只示意一次躍遷。'
        ]
      },
      en: {
        name: 'Valence & conduction',
        headline: ['Bands are allowed', 'ranges of electron energies.'],
        lede: 'For an ideal, undoped semiconductor at 0 K, the valence band is the highest filled band. The conduction band is the next allowed band above it.',
        beats: ['The band gap between them has no available states.', 'Enough absorbed energy can excite an electron into the conduction band.', 'The conduction electron leaves a vacancy, or hole, in the valence band.'],
        detail: [
          'Many closely spaced allowed electron states form energy bands in a solid. A band is an energy range, rather than a separate physical region. Vertical position here means electron energy; horizontal position means position in the material.',
          'For an ideal, undoped semiconductor at 0 K, the valence band is the highest completely filled band. The conduction band is the next allowed band above it, initially empty. Ec is its minimum; Ev is the valence-band maximum. The intervening band gap Eg has no available states.',
          'With enough energy, an electron can enter the conduction band and leave a valence-band vacancy, or hole. Successive filling of holes by valence electrons can also carry current. The excitation animation illustrates one transition.'
        ]
      }
    },
    {
      id: 'fermi', duration: 11000,
      cn: {
        name: '費米能階 EF',
        headline: ['EF 是判斷電子', '填入機率的能量基準。'],
        lede: '能帶決定哪裡有可用能態；費米能階描述它們多容易被電子佔據。EF 可以在能隙內，卻不代表那裡放著電子。',
        beats: ['熱平衡時，可用能態的填入機率隨能量而變。', '在 T > 0 K，低於 EF 的能態較容易被填入。', '若 EF 處有可用能態，佔據機率恰好是 50%。'],
        detail: [
          '熱平衡時，費米能階 EF 是電子佔據機率的能量基準，不是一個電子軌道或電子必須停留的位置。能帶告訴我們有哪些能態，EF 則幫助判斷那些能態的填入程度。',
          '在 T > 0 K，低於 EF 的可用能態，電子佔據機率大於 50%；高於 EF 的則小於 50%。若剛好在 EF 處存在可用能態，佔據機率為 50%。這不表示整個材料有一半電子。',
          'EF 即使位於能隙內，仍可作為其他能態的佔據基準。能隙裡沒有可用能態，因此不會因為畫了一條 EF 虛線就多出電子可待的位置。'
        ]
      },
      en: {
        name: 'Fermi level EF',
        headline: ['EF is the reference', 'for electron occupation.'],
        lede: 'Bands identify available states. The Fermi level describes how readily electrons occupy them. EF can lie in the gap without an electron sitting there.',
        beats: ['At equilibrium, occupation probability depends on state energy.', 'At T > 0 K, available states below EF are more likely to be occupied.', 'If a state exists at EF, its occupation probability is exactly 50%.'],
        detail: [
          'At thermal equilibrium, EF is the energy reference for electron occupation probabilities. It is not an electron orbit or a location where electrons must sit. The bands specify the available states; EF helps describe how those states are filled.',
          'At T > 0 K, an available state below EF has an occupation probability above 50%; a state above EF has one below 50%. If a state exists exactly at EF, its probability is 50%. This is a probability for an available state, not a count of half the material’s electrons.',
          'EF can lie in the band gap and still serve as the reference for occupation elsewhere. The gap has no available states, so drawing EF there does not create a place for an electron.'
        ]
      }
    },
    {
      id: 'offsets', duration: 10000,
      cn: {
        name: '接面與位差',
        headline: ['導帶與價帶，', '各有一道接面位差。'],
        lede: '兩種材料的能帶邊緣不必等高。ΔEc 比較兩側導帶底，ΔEv 比較兩側價帶頂；這裡都以 B 減 A 定義。',
        beats: ['兩種不同半導體接起來，形成異質接面。', '導帶底的能量差，是導帶位差 ΔEc。', '價帶頂的能量差，是價帶位差 ΔEv。'],
        detail: [
          '異質接面兩側的材料不同，導帶底與價帶頂在交界處可以有不連續的能量落差。只知道兩種材料的能隙大小，還不足以判斷它們的相對排列。',
          '這裡定義 ΔEc＝Ec(B) − Ec(A)，ΔEv＝Ev(B) − Ev(A)。負的 ΔEc 表示 B 的導帶底較低；正的 ΔEv 表示 B 的價帶頂較高。',
          '達到熱平衡後，兩側共用相同 EF，但能帶邊緣仍可有位差。真實接面常伴隨能帶彎曲；這裡用平直區域單獨呈現位差的影響。'
        ]
      },
      en: {
        name: 'Interface & offsets',
        headline: ['Two band edges.', 'Two interface offsets.'],
        lede: 'The edges need not align. ΔEc compares the conduction minima; ΔEv compares the valence maxima. Every offset here is defined as B minus A.',
        beats: ['Two different semiconductors meet at a heterojunction.', 'The conduction-edge difference is the offset ΔEc.', 'The valence-edge difference is the offset ΔEv.'],
        detail: [
          'Different materials can have discontinuities in their band-edge energies at an interface. Knowing their band-gap sizes alone does not determine how the bands align.',
          'Here ΔEc = Ec(B) − Ec(A), and ΔEv = Ev(B) − Ev(A). A negative ΔEc means a lower conduction edge in B. A positive ΔEv means a higher valence edge in B.',
          'At thermal equilibrium, both sides share one EF even though the band edges can have offsets. Real junctions often also show band bending. Flat regions here isolate the influence of the offsets.'
        ]
      }
    },
    {
      id: 'electrons', duration: 10000,
      cn: {
        name: '電子的偏好',
        headline: ['導帶底越低，', '越有利於電子聚集。'],
        lede: 'B 的導帶底較低，電子進入 B 後可佔據較低能量的狀態。在其他條件相近時，電子分布便偏向 B。',
        beats: ['B 的導帶底，比 A 的導帶底低。', '電子進入 B，對應的能量可以降低。', '共同 EF 下，較低的 Ec 通常對應較多導帶電子。'],
        detail: [
          '這裡比較導帶中的電子。當 B 的 Ec 較低，B 提供的最低導帶能量也較低，成為較有利的電子位置。',
          '在共同 EF、相同溫度及相同對應有效態密度的非簡併近似下，nB/nA＝exp(−ΔEc/kBT)。因此 ΔEc 越負，電子濃度的比例越偏向 B。',
          '動畫的一顆電子用來說明有利方向，不表示每顆電子只往單一方向移動。平衡時仍有熱運動與跨界交換，整體分布才是比較的對象。'
        ]
      },
      en: {
        name: 'Electron preference',
        headline: ['A lower conduction edge', 'favors electrons.'],
        lede: 'B offers a lower conduction edge. An electron entering B can occupy a lower-energy state, so the distribution favors B when other conditions are similar.',
        beats: ['The conduction edge in B is lower than in A.', 'An electron can lower its energy by entering B.', 'With a common EF, a lower Ec generally favors more conduction electrons.'],
        detail: [
          'This scene compares conduction electrons. A lower Ec in B provides a lower minimum conduction energy and makes B the more favorable side.',
          'In the nondegenerate approximation with one common EF, equal temperature and equal corresponding effective densities of states, nB/nA = exp(−ΔEc/kBT). A more negative ΔEc therefore favors a larger electron concentration in B.',
          'The illustrated electron indicates the favorable direction rather than one-way motion of every electron. Thermal motion and exchange continue at equilibrium; the overall distribution is what matters.'
        ]
      }
    },
    {
      id: 'holes', duration: 12000,
      cn: {
        name: '電洞的偏好',
        headline: ['價帶頂越高，', '越有利於電洞聚集。'],
        lede: '先讓 A 有一個空位。B 的電子到 A 補空位時，電子能量降低，而新的空位留在 B：電洞就換到了 B。',
        beats: ['A 有一個空位；B 有一顆價帶電子。', 'B 的電子到較低能量的 A，填補空位。', 'A 填滿了，B 空出來；電洞等效地從 A 移到 B。'],
        detail: [
          '圖的縱軸一直是電子能量。B 的價帶頂較高時，B 的價帶電子可以去填補 A 較低能量的空位，並降低電子的能量。',
          '電子離開 B 後，B 留下一個新空位。因此電子從 B 到 A，等效的電洞便從 A 到 B。用這個「補空位」過程，便能理解電洞為何偏向較高的價帶頂。',
          '在共同 EF、相同溫度及相同對應有效態密度的非簡併近似下，pB/pA＝exp(+ΔEv/kBT)。ΔEv 越正，電洞濃度的比例越偏向 B。'
        ]
      },
      en: {
        name: 'Hole preference',
        headline: ['A higher valence edge', 'favors holes.'],
        lede: 'An electron from B fills a lower-energy vacancy in A, leaving a new vacancy in B. The hole has effectively moved into B.',
        beats: ['A has a vacancy; B has a valence electron.', 'The electron fills the lower-energy vacancy in A.', 'A is filled and B is empty: the hole effectively moves from A to B.'],
        detail: [
          'The vertical axis still shows electron energy. When B has the higher valence edge, a valence electron in B can fill a lower-energy vacancy in A and reduce its energy.',
          'The electron leaving B creates a new vacancy there. An electron moving from B to A therefore corresponds to a hole moving from A to B. Following the vacancy explains why holes favor the higher valence edge.',
          'In the nondegenerate approximation with one common EF, equal temperature and equal corresponding effective densities of states, pB/pA = exp(+ΔEv/kBT). A more positive ΔEv favors a larger hole concentration in B.'
        ]
      }
    },
    {
      id: 'types', duration: 12000,
      cn: {
        name: 'Type I 與 Type II',
        headline: ['同一側，或分兩側。', '差別就在能帶排列。'],
        lede: '最低 Ec 與最高 Ev 在同一材料，是 Type I；分屬不同材料，是 Type II。',
        beats: ['Type I：最低 Ec 與最高 Ev 同在 B。', '只降低 B 的價帶頂，電子的有利側仍是 B。', 'Type II：電子偏向 B，電洞改為偏向 A。'],
        detail: [
          'Type I 排列中，最低導帶底與最高價帶頂位於同一材料，電子與電洞能量鬆弛後通常偏向同側。Type II 中，兩個有利位置分屬不同材料，促進兩種載子的分離。',
          '此動畫固定 B 的導帶底較低，再調整 B 的價帶頂。因此電子一直偏好 B；當價帶頂的相對高低翻轉，電洞偏好的材料跟著改變。',
          'Ec、Ev 的相對位置用來辨認排列類型；EF 用來描述熱平衡下的能態佔據。當某個位差為零時，該能帶邊緣對齊，屬於這裡比較的邊界情況。'
        ]
      },
      en: {
        name: 'Type I & Type II',
        headline: ['Together or apart.', 'The alignment decides.'],
        lede: 'Type I puts the lowest Ec and highest Ev in one material. Type II puts these favorable locations in different materials.',
        beats: ['Type I: the lowest Ec and highest Ev are both in B.', 'Lower only the valence edge in B; electrons still favor B.', 'Type II: electrons favor B, while holes now favor A.'],
        detail: [
          'In Type I, the lowest conduction minimum and highest valence maximum belong to the same material. Relaxed electrons and holes generally favor that material. In Type II, the favorable locations belong to different materials, promoting separation.',
          'This animation keeps the conduction edge lower in B while changing its valence edge. Electrons continue to favor B. When the relative valence-edge heights reverse, the favorable hole location changes.',
          'Relative Ec and Ev positions identify the alignment, while EF describes equilibrium occupation. A zero offset means the corresponding edges align, forming a boundary case in this comparison.'
        ]
      }
    },
    {
      id: 'well', duration: 11000,
      cn: {
        name: '薄層中的侷限',
        headline: ['用兩側能障，', '把載子留在薄層。'],
        lede: '把 Type I 中有利的材料 B 做成薄層，兩側包上 A。中間有利、兩側有能障，適當結構便能形成量子井。',
        beats: ['材料 A 從兩側包住有限厚度的 B。', 'B 的低 Ec 與高 Ev，讓兩種載子都偏向中間。', '兩側的能障，使載子可侷限在有限區域。'],
        detail: [
          '單一 A／B 接面只告訴我們載子偏好哪種材料。要說明載子被侷限在有限的薄層，還需要在薄層兩側形成能障，例如 A／B／A 結構。',
          '在這個 Type I 例子，B 的 Ec 比兩側低、Ev 比兩側高，分別對電子與電洞形成有利的中間區域。適當薄層能形成量子井與束縛態，薄層厚度也會影響允許能階。',
          '有限能障不代表載子永遠無法離開。溫度、井深、厚度與量子穿隧等因素都會影響侷限。圖中先呈現形成侷限的能帶結構，沒有計算量子井的離散能階。'
        ]
      },
      en: {
        name: 'Thin-layer confinement',
        headline: ['Barriers on both sides.', 'Carriers in a thin layer.'],
        lede: 'Put favorable Type I material B in a thin layer between A. The middle region and two barriers can form a quantum well.',
        beats: ['Material A surrounds a finite-thickness B layer.', 'The lower Ec and higher Ev favor both carriers in the middle.', 'The two barriers can confine carriers within a finite region.'],
        detail: [
          'A single A/B interface identifies the favorable material. Spatial confinement within a finite layer additionally requires barriers on both sides, as in an A/B/A structure.',
          'In this Type I example, B has a lower Ec and higher Ev than its neighbors. Both carriers favor the middle. A suitable thin layer forms a quantum well with bound states; layer thickness also changes its allowed energies.',
          'Finite barriers do not make escape impossible. Temperature, well depth, thickness and tunneling affect confinement. The illustration shows the confining band structure without calculating discrete quantum-well energies.'
        ]
      }
    },
    {
      id: 'emission', duration: 12000,
      cn: {
        name: 'Type I：實際應用',
        headline: ['照明、顯示，', '還有雷射與光纖通訊。'],
        lede: '採用 Type I 異質結構的元件，可出現在 LED 照明與顯示、光碟讀取、條碼掃描，以及光纖通訊光源中。',
        applications: [
          {id: 'led', name: 'LED 照明與顯示', use: '用於室內照明、交通號誌與顯示背光。', kind: 'led'},
          {id: 'laser', name: '半導體雷射', use: '用於條碼掃描與光碟資料讀取。', kind: 'laser'},
          {id: 'fiber', name: '光纖通訊光源', use: '用於網路與資料傳輸設備的雷射光源。', kind: 'fiber'}
        ],
        beats: ['LED：從室內照明到交通號誌與顯示器。', '半導體雷射：用於條碼掃描與光碟讀取。', '光纖通訊：用半導體雷射光源傳送資料。'],
        detail: [
          'LED 照明與顯示：採用相應 Type I 異質結構的 LED，可用於照明燈具、交通號誌、車燈，以及顯示器或背光模組。這些是日常可見的光電產品。',
          '半導體雷射：雷射二極體可用於 CD、DVD、Blu-ray 等光碟的讀寫頭，也可見於條碼掃描器與雷射印表機。',
          '光纖通訊：半導體雷射可作為光纖網路與資料傳輸設備中的光源。從通訊模組到長距離光纖鏈路，都有相應的異質結構雷射設計。'
        ]
      },
      en: {
        name: 'Type I: applications',
        headline: ['Lighting and displays.', 'Lasers and fiber links.'],
        lede: 'Devices using Type I heterostructures appear in LED lighting and displays, optical-disc readers, barcode scanners, and semiconductor laser sources for fiber communication.',
        applications: [
          {id: 'led', name: 'LED lighting & displays', use: 'Lighting rooms, traffic signals and display backlight modules.', kind: 'led'},
          {id: 'laser', name: 'Semiconductor lasers', use: 'Reading barcodes and data stored on optical discs.', kind: 'laser'},
          {id: 'fiber', name: 'Fiber-optic links', use: 'Providing laser light sources for networks and data links.', kind: 'fiber'}
        ],
        beats: ['LEDs appear in lighting, traffic signals and display products.', 'Laser diodes serve barcode scanners and optical-disc readers.', 'Semiconductor lasers provide light sources for fiber-optic data links.'],
        detail: [
          'LED lighting and displays: LEDs using suitable Type I heterostructures are found in lighting fixtures, traffic signals, vehicle lights, displays and backlight modules. These are familiar examples of optoelectronic products.',
          'Semiconductor lasers: laser diodes are used in CD, DVD and Blu-ray optical pickups, barcode scanners and laser printers.',
          'Fiber communication: semiconductor lasers supply light for fiber-optic networking and data-transmission equipment. Suitable heterostructure laser designs serve communication modules and long-distance optical links.'
        ]
      }
    },
    {
      id: 'separation', duration: 12000,
      cn: {
        name: 'Type II：紅外線應用',
        headline: ['熱影像與氣體感測，', '也用於衛星觀測研發。'],
        lede: 'Type II 超晶格感測器可用於紅外線熱影像與甲烷偵測，也正在開發地球觀測與小型衛星成像。',
        applications: [
          {id: 'thermal', name: '紅外線熱像儀', use: '呈現夜間或低光環境中的熱影像。', kind: 'thermal'},
          {id: 'gas', name: '甲烷氣體感測', use: '用於管線與設備的氣體洩漏監測。', kind: 'gas'},
          {id: 'satellite', name: '衛星遙測研發', use: '用於地表熱紅外線與高光譜成像研究。', kind: 'satellite'}
        ],
        beats: ['紅外線熱像儀：呈現夜間或低光環境的影像。', '甲烷感測器：監測管線與設備的氣體洩漏。', '衛星感測器研發：進行地表與高光譜成像。'],
        detail: [
          '紅外線熱像儀：Type II 超晶格紅外線陣列已用於實際熱影像系統。IRnova 的官方應用資料展示了這類感測器拍攝的人物熱影像，可用於低光或夜間觀察等系統。',
          '甲烷氣體感測：研究已示範以 InAs/InAsSb Type II 超晶格偵測器製成的甲烷感測模組，可用於氣體偵測與洩漏監測的儀器開發。',
          '衛星遙測研發：NASA/JPL 的 Type II 超晶格陣列研究，包含地表長波紅外線成像與 CubeSat 中波紅外線高光譜成像。此項展示的是太空觀測儀器的研究與開發用途。'
        ]
      },
      en: {
        name: 'Type II: infrared applications',
        headline: ['Thermal and gas sensing.', 'Satellite imaging R&D.'],
        lede: 'Type II superlattice sensors serve infrared thermal imaging and methane detection. Earth observation and compact satellite imaging are also active development applications.',
        applications: [
          {id: 'thermal', name: 'Thermal imaging', use: 'Showing thermal scenes in darkness and low-light conditions.', kind: 'thermal'},
          {id: 'gas', name: 'Methane sensing', use: 'Monitoring gas leaks around pipelines and industrial equipment.', kind: 'gas'},
          {id: 'satellite', name: 'Satellite imaging R&D', use: 'Developing land thermal imaging and hyperspectral observation instruments.', kind: 'satellite'}
        ],
        beats: ['Infrared cameras show thermal scenes in low-light or nighttime conditions.', 'Methane sensors support gas-leak monitoring around pipes and equipment.', 'Satellite sensor research targets land imaging and hyperspectral observation.'],
        detail: [
          'Thermal imaging: Type II superlattice infrared arrays are used in working thermal-imaging systems. IRnova’s official application note shows thermal images of people recorded with these detectors, supporting systems for low-light and nighttime observation.',
          'Methane sensing: researchers have demonstrated a methane-sensing module using an InAs/InAsSb Type II superlattice detector. It is an example for the development of gas-detection and leak-monitoring instruments.',
          'Satellite imaging R&D: NASA/JPL research on Type II superlattice arrays includes long-wave infrared land imaging and mid-wave infrared CubeSat hyperspectral imaging. This example is explicitly a space-instrument research and development application.'
        ]
      }
    },
    {
      id: 'experiment', duration: 0,
      cn: {
        name: '位差與分布',
        headline: ['只改一個位差，', '看一種載子怎麼分布。'],
        lede: '固定材料 A，分別改變 B 的導帶底與價帶頂。ΔEc 影響電子偏向，ΔEv 影響電洞偏向；溫度改變偏向的程度。',
        beats: ['降低 B 的導帶底，電子比例偏向 B。', '提高 B 的價帶頂，電洞比例偏向 B。', '固定能帶時，升溫讓兩側比例較接近。'],
        detail: [
          '這裡的百分比來自非簡併熱平衡模型：兩側共用 EF，溫度相同，對應有效態密度與體積相同，並忽略能帶彎曲及界面態。位差範圍為 −0.10 至 +0.10 eV；溫度可設為 200 至 500 K。',
          'nB/nA＝exp(−ΔEc/kBT)，pB/pA＝exp(+ΔEv/kBT)。把 A 與 B 的數量正規化，得到畫面的兩側分布百分比。相同對應有效態密度與體積的假設，讓這些比例可直接用位差比較。',
          '比例不是載子總數。溫度控制只比較固定能帶與上述假設下的相對分布，沒有計算總載子濃度隨溫度的改變。真實接面還要考慮摻雜、電位、能帶彎曲與材料差異。'
        ]
      },
      en: {
        name: 'Offsets & distribution',
        headline: ['Change one offset.', 'Watch one carrier respond.'],
        lede: 'Keep A fixed and change each band edge in B. ΔEc affects electron preference; ΔEv affects hole preference. Temperature changes the strength of that preference.',
        beats: ['Lower Ec in B to favor a larger electron share there.', 'Raise Ev in B to favor a larger hole share there.', 'With fixed bands, higher temperature brings the shares closer together.'],
        detail: [
          'The percentages use a nondegenerate thermal-equilibrium model: one common EF, equal temperature, equal corresponding effective densities of states and equal volumes. Band bending and interface states are neglected. Offsets range from −0.10 to +0.10 eV, and temperature from 200 to 500 K.',
          'nB/nA = exp(−ΔEc/kBT), and pB/pA = exp(+ΔEv/kBT). Normalizing the populations in A and B gives the displayed shares. Equal corresponding densities of states and volumes allow these shares to be compared directly through the offsets.',
          'Shares are not total carrier numbers. Temperature compares relative distributions for fixed bands and the stated assumptions; it does not calculate temperature-dependent total concentrations. Real junctions also require doping, electrostatic, band-bending and material information.'
        ]
      }
    }
  ];

  const model = {
    cn: [
      '縱軸是電子能量，橫軸是材料中的位置。淡色區表示畫出的允許能帶，實心圓表示電子，空心圓表示電洞；載子數量、動線、厚度與能量尺度均為示意。',
      '熱平衡兩側共用相同費米能階。電子激發及單一載子移動的動畫只示意能量與空位的變化，不以單一平衡 EF 描述過程中的瞬間狀態。',
      '實驗採非簡併熱平衡、兩側對應有效態密度與體積相同的簡化模型，忽略能帶彎曲及界面態。定義 ΔEc＝Ec(B) − Ec(A)，ΔEv＝Ev(B) − Ev(A)；kB＝8.617333262 × 10⁻⁵ eV/K。',
      '在這些條件下，nB/nA＝exp(−ΔEc/kBT)，pB/pA＝exp(+ΔEv/kBT)。正規化後為 nB/(nA+nB)＝1/[1+exp(ΔEc/kBT)]，pB/(pA+pB)＝1/[1+exp(−ΔEv/kBT)]。畫面顯示相對比例，不是載子總數。',
      'Type I 的有利位置在同一材料。有限薄層的空間侷限還需要兩側能障與適當結構；此處未計算離散束縛能階。真實接面需另外考慮摻雜、電位、自洽能帶彎曲及材料參數。'
    ],
    en: [
      'Vertical position is electron energy; horizontal position is material position. Shading shows the allowed bands drawn here. Solid circles indicate electrons and hollow circles holes. Carrier counts, paths, thicknesses and energy scales are schematic.',
      'Both sides share one Fermi level at thermal equilibrium. Excitation and single-carrier animations illustrate energy and vacancy changes; their instantaneous states are not described by one equilibrium EF.',
      'The experiment uses a simplified nondegenerate thermal-equilibrium model with equal corresponding effective densities of states and equal volumes. Band bending and interface states are neglected. ΔEc = Ec(B) − Ec(A), ΔEv = Ev(B) − Ev(A), and kB = 8.617333262 × 10⁻⁵ eV/K.',
      'Under these assumptions, nB/nA = exp(−ΔEc/kBT) and pB/pA = exp(+ΔEv/kBT). Normalization gives nB/(nA+nB) = 1/[1+exp(ΔEc/kBT)] and pB/(pA+pB) = 1/[1+exp(−ΔEv/kBT)]. The display shows relative shares rather than total carrier numbers.',
      'Type I puts both favorable locations in one material. Confinement within a finite layer additionally requires barriers and a suitable structure; discrete bound-state energies are not calculated here. Real junctions also require doping, electrostatics, self-consistent band bending and material parameters.'
    ]
  };

  const sources = [
    {label: 'NPTEL · Fermi level and electron occupation', cn: 'NPTEL：費米能階與佔據機率', url: 'https://archive.nptel.ac.in/content/storage2/courses/115102025/module2/1.html'},
    {label: 'Kiel University · Ideal heterojunctions', cn: 'Kiel University：異質接面與能帶位差', url: 'https://www.tf.uni-kiel.de/matwis/amat/semi_en/kap_5/backbone/r5_3_1.html'},
    {label: 'Graz University of Technology · Carrier concentration vs. Fermi energy', cn: 'Graz University：載子濃度與費米能階', url: 'https://lampz.tugraz.at/~hadley/psd/L4/efplot.html'},
    {label: 'University of Illinois · LEDs, heterostructure confinement and lasers', cn: 'University of Illinois：LED、異質結構侷限與雷射', url: 'https://transport.ece.illinois.edu/ECE340F14-Lectures/ECE340Lecture29-LEDs-Dist.pdf', scenes: ['emission']},
    {label: 'NPTEL · Radiative and nonradiative optical processes', cn: 'NPTEL：輻射與非輻射光學過程', url: 'https://archive.nptel.ac.in/content/storage2/courses/115102025/module4/1.html'},
    {label: 'NPTEL · LEDs and semiconductor laser diodes', cn: 'NPTEL：LED 與半導體雷射二極體', url: 'https://archive.nptel.ac.in/content/storage2/courses/115102025/module5/4.html', scenes: ['emission']},
    {label: 'Ross et al. · Interlayer exciton optoelectronics in a 2D p–n junction', cn: 'Ross 等人：Type II 層間激子的光偵測與發光', url: 'https://arxiv.org/abs/1701.00802', scenes: ['separation']},
    {label: 'Nobel Prize · Heterostructure device applications', cn: 'Nobel Prize：異質結構的照明、雷射與光纖通訊應用', url: 'https://www.nobelprize.org/uploads/2018/06/advanced-physicsprize2000-3.pdf', scenes: ['emission']},
    {label: 'IRnova · Type II superlattice thermal-imaging application note', cn: 'IRnova：Type II 超晶格熱影像實例', url: 'https://uploads-ssl.webflow.com/627385e34e1854eb6c6cf867/628cb6c29d007c496f1d2174_irnovaapplication-note-t2sl-v1.0-20191121.pdf', scenes: ['separation']},
    {label: 'Martyniuk et al. · Type II superlattice methane sensor', cn: 'Martyniuk 等人：Type II 超晶格甲烷感測器', url: 'https://doi.org/10.1016/j.sna.2021.113107', scenes: ['separation']},
    {label: 'NASA/JPL · Type II superlattice arrays for Earth science', cn: 'NASA/JPL：Type II 超晶格地球觀測儀器研發', url: 'https://ntrs.nasa.gov/citations/20230005634', scenes: ['separation']}
  ];

  window.BandStoryData = {scenes, model, sources};
})();
