import { useEffect, useMemo } from "react";
import { useDataSourceStore } from "../store/datasourceStore";
import { dataSourceEventBus } from "../datasource/events";

export function useDataSourceBinding(_componentId: string, dataSourceIds?: string[]) {
  const {
    dataSources,
    dataCache,
  } = useDataSourceStore();

  useEffect(() => {
    if (!dataSourceIds) return;

    const handler = (event: { sourceId: string }) => {
      if (dataSourceIds.includes(event.sourceId)) {
        // data will be available via dataCache
      }
    };

    dataSourceEventBus.on("data:updated", handler);

    return () => {
      dataSourceEventBus.off("data:updated", handler);
    };
  }, [dataSourceIds]);

  const boundDataSources = useMemo(
    () => dataSources.filter((ds) => dataSourceIds?.includes(ds.id)),
    [dataSourceIds, dataSources]
  );

  const componentData = useMemo(() => {
    const result: Record<string, unknown> = {};
    dataSourceIds?.forEach((id) => {
      const cached = dataCache[id];
      if (cached) {
        result[id] = cached;
      }
    });
    return result;
  }, [dataSourceIds, dataCache]);

  return {
    boundDataSources,
    componentData,
    on: dataSourceEventBus.on.bind(dataSourceEventBus),
  };
}
